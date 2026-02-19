require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const PostsDatabase = require('./db');

// Configuration
const PORT = process.env.PORT || 3000;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 300000; // 5 minutes default
const LOG_PATH = process.env.LOG_PATH || path.join(__dirname, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_PATH)) {
    fs.mkdirSync(LOG_PATH, { recursive: true });
}

// Logging utility
function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data })
    };

    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
    console.log(logLine);

    // Append to log file
    const logFile = path.join(LOG_PATH, 'server.log');
    fs.appendFileSync(logFile, logLine + '\n');

    return logEntry;
}

// Initialize database
const db = new PostsDatabase();

// OAuth token cache
let tokenCache = {
    token: null,
    expiresAt: 0
};

// Get Reddit OAuth token
async function getRedditToken() {
    if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
        return tokenCache.token;
    }

    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret || clientId === 'your_client_id_here') {
        log('warn', 'Reddit API credentials not configured - using demo mode');
        return null;
    }

    try {
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const response = await axios.post(
            'https://www.reddit.com/api/v1/access_token',
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': process.env.REDDIT_USER_AGENT || 'ClaudeRedditAggregator/1.0.0'
                },
                timeout: 10000
            }
        );

        tokenCache.token = response.data.access_token;
        tokenCache.expiresAt = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 min early

        log('info', 'Reddit OAuth token obtained');
        return tokenCache.token;
    } catch (error) {
        log('error', 'Failed to get Reddit OAuth token', { error: error.message });
        return null;
    }
}

// Fetch posts from a subreddit with retry logic
async function fetchSubredditPosts(subreddit, token, retries = 3) {
    const startTime = Date.now();
    const keywords = ['claude', 'claude code', 'anthropic', 'ai coding', 'ai assistant'];

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const headers = {
                'User-Agent': process.env.REDDIT_USER_AGENT || 'ClaudeRedditAggregator/1.0.0'
            };

            let url;
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                url = `https://oauth.reddit.com/r/${subreddit}/new?limit=100`;
            } else {
                // Use public API if no token
                url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100`;
            }

            const response = await axios.get(url, {
                headers,
                timeout: 10000
            });

            const data = token ? response.data : response.data;
            const posts = data.data.children.map(child => child.data);

            // Filter posts from last 30 days containing Claude-related keywords
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            const filteredPosts = posts.filter(post => {
                const postTime = post.created_utc * 1000;
                if (postTime < thirtyDaysAgo) return false;

                const titleLower = post.title.toLowerCase();
                const bodyLower = (post.selftext || '').toLowerCase();
                const hasKeyword = keywords.some(kw =>
                    titleLower.includes(kw.toLowerCase()) ||
                    bodyLower.includes(kw.toLowerCase())
                );

                // For Claude-specific subreddits, include all posts
                if (['claude', 'claudeai', 'claudedev', 'anthropicai'].includes(subreddit.toLowerCase())) {
                    return true;
                }

                return hasKeyword;
            });

            const duration = Date.now() - startTime;
            log('info', `Fetched posts from r/${subreddit}`, {
                total: posts.length,
                filtered: filteredPosts.length,
                duration: `${duration}ms`
            });

            return filteredPosts.map(post => ({
                reddit_id: post.id,
                title: post.title,
                content: post.selftext ? post.selftext.substring(0, 1000) : '',
                author: post.author,
                subreddit: post.subreddit,
                upvotes: post.score,
                num_comments: post.num_comments,
                created_at: new Date(post.created_utc * 1000).toISOString(),
                url: `https://reddit.com${post.permalink}`
            }));

        } catch (error) {
            const delay = Math.pow(3, attempt) * 1000; // Exponential backoff: 3s, 9s, 27s
            log('warn', `Attempt ${attempt}/${retries} failed for r/${subreddit}`, {
                error: error.message,
                retryIn: `${delay / 1000}s`
            });

            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                log('error', `All retries failed for r/${subreddit}`, { error: error.message });
                return [];
            }
        }
    }
    return [];
}

// Fetch posts from all subreddits
async function fetchAllPosts() {
    const subreddits = ['ClaudeAI', 'claude', 'claudedev', 'AnthropicAI', 'OpenAI', 'MachineLearning', 'LocalLLaMA', 'artificial', 'singularity', 'ChatGPT', 'Bard', 'bing', 'perplexity_ai'];
    const token = await getRedditToken();

    log('info', 'Starting fetch from all subreddits', { subreddits });

    const allPosts = [];
    for (const subreddit of subreddits) {
        const posts = await fetchSubredditPosts(subreddit, token);
        allPosts.push(...posts);

        // Rate limiting: wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Remove duplicates by reddit_id
    const uniquePosts = [];
    const seenIds = new Set();
    for (const post of allPosts) {
        if (!seenIds.has(post.reddit_id)) {
            seenIds.add(post.reddit_id);
            uniquePosts.push(post);
        }
    }

    // Save to database
    if (uniquePosts.length > 0) {
        db.upsertPosts(uniquePosts);
        log('info', `Saved ${uniquePosts.length} unique posts to database`);
    }

    return uniquePosts;
}

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001'],
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        log('info', `${req.method} ${req.url}`, {
            status: res.statusCode,
            duration: `${Date.now() - start}ms`
        });
    });
    next();
});

// Posts cache
let postsCache = {
    data: null,
    timestamp: 0,
    ttl: 5 * 60 * 1000 // 5 minutes
};

// API Routes
app.get('/api/posts', async (req, res) => {
    try {
        const {
            search = '',
            subreddit = '',
            sortBy = 'created_at',
            sortOrder = 'desc',
            page = 1,
            limit = 20,
            minUpvotes = 0
        } = req.query;

        const result = db.getPosts({
            search,
            subreddit,
            sortBy,
            sortOrder: sortOrder.toLowerCase(),
            page: parseInt(page),
            limit: Math.min(parseInt(limit), 100), // Max 100 per page
            minUpvotes: parseInt(minUpvotes),
            daysBack: 30
        });

        res.json({
            success: true,
            ...result,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        log('error', 'Error fetching posts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch posts',
            message: error.message
        });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const stats = db.getStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        log('error', 'Error fetching stats', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats'
        });
    }
});

app.post('/api/refresh', async (req, res) => {
    try {
        log('info', 'Manual refresh triggered');
        const posts = await fetchAllPosts();
        io.emit('posts-updated', {
            count: posts.length,
            timestamp: new Date().toISOString()
        });
        res.json({
            success: true,
            message: `Refreshed ${posts.length} posts`
        });
    } catch (error) {
        log('error', 'Error during manual refresh', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to refresh posts'
        });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Serve React app for all other routes (Express v5 syntax)
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
let connectedClients = 0;

io.on('connection', (socket) => {
    connectedClients++;
    log('info', 'Client connected', { clientId: socket.id, totalClients: connectedClients });

    // Send current stats on connection
    socket.emit('stats', db.getStats());

    socket.on('disconnect', () => {
        connectedClients--;
        log('info', 'Client disconnected', { clientId: socket.id, totalClients: connectedClients });
    });

    socket.on('request-refresh', async () => {
        log('info', 'Client requested refresh', { clientId: socket.id });
        const posts = await fetchAllPosts();
        io.emit('posts-updated', {
            count: posts.length,
            timestamp: new Date().toISOString()
        });
    });
});

// Periodic polling
let pollInterval;

async function startPolling() {
    log('info', `Starting polling with interval ${POLL_INTERVAL / 1000}s`);

    // Initial fetch
    await fetchAllPosts();

    // Create backup after initial fetch
    db.backup();

    // Set up interval
    pollInterval = setInterval(async () => {
        try {
            const posts = await fetchAllPosts();
            io.emit('posts-updated', {
                count: posts.length,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            log('error', 'Polling error', { error: error.message });
        }
    }, POLL_INTERVAL);
}

// Daily backup scheduler
function scheduleDailyBackup() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
        db.backup();
        generateDailyReport();
        // Schedule next backup
        setInterval(() => {
            db.backup();
            generateDailyReport();
        }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    log('info', `Daily backup scheduled for ${tomorrow.toISOString()}`);
}

// Generate daily report
function generateDailyReport() {
    const date = new Date().toISOString().split('T')[0];
    const stats = db.getStats();

    const report = {
        date,
        generatedAt: new Date().toISOString(),
        stats,
        connectedClients,
        uptime: process.uptime()
    };

    const reportFile = path.join(LOG_PATH, `daily-report-${date}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    log('info', 'Daily report generated', { file: reportFile });
}

// Graceful shutdown
function gracefulShutdown() {
    log('info', 'Shutting down gracefully...');

    if (pollInterval) {
        clearInterval(pollInterval);
    }

    io.close(() => {
        log('info', 'Socket.IO connections closed');
    });

    server.close(() => {
        log('info', 'HTTP server closed');
        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        log('warn', 'Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
server.listen(PORT, () => {
    log('info', `Server started on http://localhost:${PORT}`);
    log('info', `Environment: ${process.env.NODE_ENV || 'development'}`);

    // Start polling and scheduling
    startPolling();
    scheduleDailyBackup();
});

module.exports = { app, server, io };
