const fs = require('fs');
const path = require('path');

// Simple JSON-based database for posts (no native compilation needed)
class PostsDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, 'data', 'posts.json');
        this.backupPath = process.env.BACKUP_PATH || path.join(__dirname, 'backups');
        this.posts = [];
        this.ensureDirectories();
        this.load();
    }

    ensureDirectories() {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.backupPath)) {
            fs.mkdirSync(this.backupPath, { recursive: true });
        }
    }

    load() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf-8');
                this.posts = JSON.parse(data);
                console.log(`[${new Date().toISOString()}] Loaded ${this.posts.length} posts from database`);
            } else {
                this.posts = [];
                this.save();
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error loading database:`, err.message);
            this.posts = [];
        }
    }

    save() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.posts, null, 2), 'utf-8');
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error saving database:`, err.message);
        }
    }

    // Insert or update a post
    upsertPost(post) {
        const index = this.posts.findIndex(p => p.reddit_id === post.reddit_id);
        const now = new Date().toISOString();

        const postData = {
            id: index >= 0 ? this.posts[index].id : Date.now().toString(36) + Math.random().toString(36).substr(2),
            reddit_id: post.reddit_id,
            title: post.title,
            content: post.content || '',
            author: post.author,
            subreddit: post.subreddit,
            upvotes: post.upvotes,
            num_comments: post.num_comments || 0,
            created_at: post.created_at,
            fetched_at: now,
            url: post.url
        };

        if (index >= 0) {
            this.posts[index] = postData;
        } else {
            this.posts.push(postData);
        }

        this.save();
        return postData;
    }

    // Bulk insert/update posts
    upsertPosts(posts) {
        const results = [];
        for (const post of posts) {
            results.push(this.upsertPost(post));
        }
        return results;
    }

    // Get all posts with optional filtering and pagination
    getPosts(options = {}) {
        const {
            search = '',
            subreddit = '',
            sortBy = 'created_at',
            sortOrder = 'desc',
            page = 1,
            limit = 20,
            minUpvotes = 0,
            daysBack = 30
        } = options;

        let filtered = [...this.posts];

        // Filter by date
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);
        filtered = filtered.filter(p => new Date(p.created_at) >= cutoffDate);

        // Filter by minimum upvotes
        if (minUpvotes > 0) {
            filtered = filtered.filter(p => p.upvotes >= minUpvotes);
        }

        // Filter by subreddit
        if (subreddit) {
            filtered = filtered.filter(p =>
                p.subreddit.toLowerCase().includes(subreddit.toLowerCase())
            );
        }

        // Filter by search term
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(searchLower) ||
                p.author.toLowerCase().includes(searchLower) ||
                (p.content && p.content.toLowerCase().includes(searchLower))
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let valA, valB;
            switch (sortBy) {
                case 'upvotes':
                    valA = a.upvotes;
                    valB = b.upvotes;
                    break;
                case 'num_comments':
                    valA = a.num_comments;
                    valB = b.num_comments;
                    break;
                case 'created_at':
                default:
                    valA = new Date(a.created_at).getTime();
                    valB = new Date(b.created_at).getTime();
            }
            return sortOrder === 'desc' ? valB - valA : valA - valB;
        });

        // Paginate
        const total = filtered.length;
        const totalPages = Math.ceil(total / limit);
        const offset = (page - 1) * limit;
        const paginated = filtered.slice(offset, offset + limit);

        return {
            posts: paginated,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    }

    // Get a single post by reddit_id
    getPost(redditId) {
        return this.posts.find(p => p.reddit_id === redditId);
    }

    // Delete old posts
    deleteOldPosts(daysBack = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysBack);

        const before = this.posts.length;
        this.posts = this.posts.filter(p => new Date(p.created_at) >= cutoffDate);
        const deleted = before - this.posts.length;

        if (deleted > 0) {
            this.save();
            console.log(`[${new Date().toISOString()}] Deleted ${deleted} old posts`);
        }

        return deleted;
    }

    // Create backup
    backup() {
        try {
            const date = new Date().toISOString().split('T')[0];
            const backupFile = path.join(this.backupPath, `posts-backup-${date}.json`);

            fs.writeFileSync(backupFile, JSON.stringify(this.posts, null, 2), 'utf-8');
            console.log(`[${new Date().toISOString()}] Created backup: ${backupFile}`);

            // Clean old backups (keep last 30 days)
            this.cleanOldBackups(30);

            return backupFile;
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Backup error:`, err.message);
            return null;
        }
    }

    // Clean old backups
    cleanOldBackups(retentionDays = 30) {
        try {
            const files = fs.readdirSync(this.backupPath);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            for (const file of files) {
                if (!file.startsWith('posts-backup-')) continue;

                const dateMatch = file.match(/posts-backup-(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    const fileDate = new Date(dateMatch[1]);
                    if (fileDate < cutoffDate) {
                        fs.unlinkSync(path.join(this.backupPath, file));
                        console.log(`[${new Date().toISOString()}] Deleted old backup: ${file}`);
                    }
                }
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Error cleaning backups:`, err.message);
        }
    }

    // Restore from backup
    restore(backupFile) {
        try {
            if (!fs.existsSync(backupFile)) {
                throw new Error(`Backup file not found: ${backupFile}`);
            }

            const data = fs.readFileSync(backupFile, 'utf-8');
            this.posts = JSON.parse(data);
            this.save();

            console.log(`[${new Date().toISOString()}] Restored ${this.posts.length} posts from backup`);
            return true;
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Restore error:`, err.message);
            return false;
        }
    }

    // Get statistics
    getStats() {
        const now = new Date();
        const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        const subredditCounts = {};
        let postsLast24h = 0;
        let postsLastWeek = 0;

        for (const post of this.posts) {
            const postDate = new Date(post.created_at);

            if (postDate >= dayAgo) postsLast24h++;
            if (postDate >= weekAgo) postsLastWeek++;

            subredditCounts[post.subreddit] = (subredditCounts[post.subreddit] || 0) + 1;
        }

        return {
            totalPosts: this.posts.length,
            postsLast24h,
            postsLastWeek,
            subredditCounts,
            lastUpdated: this.posts.length > 0
                ? Math.max(...this.posts.map(p => new Date(p.fetched_at).getTime()))
                : null
        };
    }
}

module.exports = PostsDatabase;
