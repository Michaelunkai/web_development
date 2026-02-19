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
    const keywords = ALL_KEYWORDS;

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

                // For dedicated subreddits, include all posts
                if (DEDICATED_SUBS.has(subreddit.toLowerCase())) {
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
                url: `https://reddit.com${post.permalink}`,
                source: 'reddit',
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

// ── Extended subreddits covering all 5 topics ────────────────────────────────
const ALL_SUBREDDITS = [
    // Claude / Anthropic
    'ClaudeAI', 'claude', 'claudedev', 'AnthropicAI',
    // Claude Code & AI coding
    'ClaudeCode', 'AICoding', 'vibecoding', 'cursor_ai', 'AIdev',
    // General AI
    'OpenAI', 'MachineLearning', 'LocalLLaMA', 'artificial', 'singularity',
    'ChatGPT', 'Bard', 'perplexity_ai', 'aipromptprogramming',
    // Agents / MCP
    'AIAgents', 'PromptEngineering',
    // Community
    'discordapp',
];

// Keywords for filtering non-dedicated subreddits
const ALL_KEYWORDS = [
    'claude', 'claude code', 'anthropic',
    'openclaw', 'openclaw.ai', 'clawhub',
    'moltbot', 'molt bot', 'moltbook',
    'clawdbot', 'clawd bot', 'clawd',
    'ai coding', 'ai assistant', 'ai agent', 'mcp server',
];

const DEDICATED_SUBS = new Set([
    'claude', 'claudeai', 'claudedev', 'anthropicai', 'claudecode',
]);

// ── Hacker News ───────────────────────────────────────────────────────────────
async function fetchHackerNews() {
    const queries = ['claude anthropic', 'claude code', 'openclaw', 'moltbot', 'clawdbot', 'anthropic AI'];
    const results = [];
    for (const q of queries) {
        try {
            const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=15`;
            const resp = await axios.get(url, { timeout: 8000 });
            for (const hit of resp.data.hits || []) {
                if (!hit.objectID) continue;
                results.push({
                    reddit_id: `hn_${hit.objectID}`,
                    title: `[HN] ${hit.title || '(no title)'}`,
                    content: (hit.story_text || '').replace(/<[^>]+>/g, '').substring(0, 600),
                    author: hit.author || 'unknown',
                    subreddit: 'HackerNews',
                    upvotes: hit.points || 0,
                    num_comments: hit.num_comments || 0,
                    created_at: new Date(hit.created_at).toISOString(),
                    url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
                    source: 'hackernews',
                });
            }
            await new Promise(r => setTimeout(r, 400));
        } catch (e) { log('warn', `HN fetch failed: ${q}`, { error: e.message }); }
    }
    return results;
}

// ── GitHub ────────────────────────────────────────────────────────────────────
async function fetchGitHub() {
    const queries = ['openclaw', 'clawdbot', 'moltbot', 'claude-code', 'anthropic claude', 'clawhub'];
    const results = [];
    const headers = { 'User-Agent': 'ClaudeAggregator/2.0' };
    if (process.env.GITHUB_TOKEN) headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    for (const q of queries) {
        try {
            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=updated&per_page=8`;
            const resp = await axios.get(url, { headers, timeout: 8000 });
            for (const repo of resp.data.items || []) {
                results.push({
                    reddit_id: `gh_${repo.id}`,
                    title: `[GitHub] ${repo.full_name} – ${(repo.description || 'No description').substring(0, 120)}`,
                    content: (repo.description || '') + (repo.topics?.length ? '\nTopics: ' + repo.topics.join(', ') : ''),
                    author: repo.owner.login,
                    subreddit: 'GitHub',
                    upvotes: repo.stargazers_count,
                    num_comments: repo.open_issues_count,
                    created_at: repo.updated_at,
                    url: repo.html_url,
                    source: 'github',
                });
            }
            await new Promise(r => setTimeout(r, 500));
        } catch (e) { log('warn', `GitHub fetch failed: ${q}`, { error: e.message }); }
    }
    return results;
}

// ── Dev.to ────────────────────────────────────────────────────────────────────
async function fetchDevTo() {
    const tags = ['claude', 'anthropic', 'claudeai', 'aitools', 'llm', 'aiagents'];
    const results = [];
    for (const tag of tags) {
        try {
            const url = `https://dev.to/api/articles?tag=${tag}&per_page=15&top=7`;
            const resp = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'ClaudeAggregator/2.0' } });
            for (const art of resp.data || []) {
                const text = ((art.title || '') + ' ' + (art.description || '')).toLowerCase();
                const relevant = DEDICATED_SUBS.has(tag) || ALL_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
                if (!relevant) continue;
                results.push({
                    reddit_id: `devto_${art.id}`,
                    title: `[Dev.to] ${art.title}`,
                    content: art.description || '',
                    author: art.user?.username || 'unknown',
                    subreddit: 'DevTo',
                    upvotes: art.positive_reactions_count || 0,
                    num_comments: art.comments_count || 0,
                    created_at: art.published_at,
                    url: art.url,
                    source: 'devto',
                });
            }
            await new Promise(r => setTimeout(r, 350));
        } catch (e) { log('warn', `Dev.to fetch failed: ${tag}`, { error: e.message }); }
    }
    return results;
}

// ── Anthropic Blog RSS ────────────────────────────────────────────────────────
async function fetchAnthropicBlog() {
    try {
        const resp = await axios.get('https://www.anthropic.com/rss.xml', { timeout: 8000, headers: { 'User-Agent': 'ClaudeAggregator/2.0' } });
        const items = (resp.data.match(/<item>([\s\S]*?)<\/item>/g) || []).slice(0, 15);
        return items.map((item, idx) => {
            const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || 'Anthropic Update';
            const link  = (item.match(/<link>(.*?)<\/link>/) || [])[1] || 'https://www.anthropic.com/news';
            const desc  = ((item.match(/<description><!\[CDATA\[(.*?)\]\]>/) || item.match(/<description>(.*?)<\/description>/) || [])[1] || '').replace(/<[^>]+>/g, '').substring(0, 500);
            const pub   = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || new Date().toISOString();
            return {
                reddit_id: `anthropic_${idx}_${Date.now()}`,
                title: `[Anthropic] ${title}`,
                content: desc,
                author: 'Anthropic',
                subreddit: 'AnthropicBlog',
                upvotes: 9999,
                num_comments: 0,
                created_at: new Date(pub).toISOString(),
                url: link,
                source: 'anthropic',
            };
        });
    } catch (e) { log('warn', 'Anthropic blog failed', { error: e.message }); return []; }
}

// ── Curated official resources (OpenClaw, MoltBot, ClawdBot) ─────────────────
function getCuratedResources() {
    return [
        { reddit_id: 'oc_site',      title: '[OpenClaw] Official Website – openclaw.ai',           content: 'OpenClaw is a personal AI assistant platform running Claude at home. Supports Telegram, WhatsApp, Discord and more. Skill system, marathon mode, local extensions.',          author: 'openclaw', subreddit: 'OpenClaw',    upvotes: 9999, num_comments: 0, created_at: new Date().toISOString(), url: 'https://openclaw.ai',          source: 'openclaw' },
        { reddit_id: 'oc_docs',      title: '[OpenClaw] Documentation & Guides',                    content: 'Complete OpenClaw docs: setup, skills, configuration, marathon mode, Android control, Telegram integration, and more.',                                                    author: 'openclaw', subreddit: 'OpenClaw',    upvotes: 9998, num_comments: 0, created_at: new Date().toISOString(), url: 'https://docs.openclaw.ai',     source: 'openclaw' },
        { reddit_id: 'oc_clawhub',   title: '[ClawHub] OpenClaw Skills Marketplace',                content: 'ClawHub is the skills/plugin marketplace for OpenClaw. Find hundreds of skills: academic research, code debugging, stock prices, and more.',                               author: 'openclaw', subreddit: 'ClawHub',     upvotes: 9997, num_comments: 0, created_at: new Date().toISOString(), url: 'https://clawhub.ai',           source: 'openclaw' },
        { reddit_id: 'oc_discord',   title: '[OpenClaw] Community Discord Server',                  content: 'Join the OpenClaw community Discord to get help, share skills, discuss features, and connect with other users.',                                                          author: 'openclaw', subreddit: 'OpenClaw',    upvotes: 9996, num_comments: 0, created_at: new Date().toISOString(), url: 'https://discord.com/invite/clawd', source: 'openclaw' },
        { reddit_id: 'moltbot_site', title: '[MoltBot] Official MoltBook – AI Discord Bot',         content: 'MoltBot is an AI-powered Discord bot built on Claude. Create, customize, and deploy Claude-based bots in your Discord server.',                                          author: 'moltbot',  subreddit: 'MoltBot',     upvotes: 9995, num_comments: 0, created_at: new Date().toISOString(), url: 'https://moltbook.com',          source: 'moltbot'  },
        { reddit_id: 'clawd_site',   title: '[ClawdBot] Claude-powered Telegram & WhatsApp Bot',    content: 'ClawdBot is the Telegram/WhatsApp interface for OpenClaw. Run Claude AI directly in messaging apps with full skill support and real-time notifications.',                  author: 'openclaw', subreddit: 'ClawdBot',    upvotes: 9994, num_comments: 0, created_at: new Date().toISOString(), url: 'https://openclaw.ai',          source: 'clawdbot' },
        { reddit_id: 'cc_docs',      title: '[Claude Code] Official Claude Code Documentation',     content: 'Claude Code is Anthropic\'s official CLI for Claude. Docs: installation, CLAUDE.md optimisation, tool use, memory management, best practices for AI-assisted development.', author: 'anthropic', subreddit: 'ClaudeCode', upvotes: 9993, num_comments: 0, created_at: new Date().toISOString(), url: 'https://docs.anthropic.com/en/docs/claude-code', source: 'anthropic' },
        { reddit_id: 'api_docs',     title: '[Anthropic] Claude API Documentation',                 content: 'Official Anthropic API: all Claude models, messages API, tool use, vision, streaming, system prompts, rate limits, Python and TypeScript SDKs.',                          author: 'anthropic', subreddit: 'AnthropicBlog', upvotes: 9992, num_comments: 0, created_at: new Date().toISOString(), url: 'https://docs.anthropic.com', source: 'anthropic' },
    ];
}

// ── Master fetch: all sources in parallel ────────────────────────────────────
async function fetchAllPosts() {
    log('info', 'Starting full multi-source fetch');
    const token = await getRedditToken();

    // Build Reddit promises (staggered 800ms apart)
    const redditPromises = ALL_SUBREDDITS.map((sub, i) =>
        new Promise(resolve => setTimeout(async () => {
            const posts = await fetchSubredditPosts(sub, token);
            resolve(posts);
        }, i * 800))
    );

    const [hn, gh, devto, blog, curated, ...redditResults] = await Promise.all([
        fetchHackerNews(),
        fetchGitHub(),
        fetchDevTo(),
        fetchAnthropicBlog(),
        Promise.resolve(getCuratedResources()),
        ...redditPromises,
    ]);

    const allPosts = [
        ...curated,
        ...blog,
        ...hn,
        ...gh,
        ...devto,
        ...redditResults.flat(),
    ];

    // Deduplicate
    const seen = new Set();
    const uniquePosts = allPosts.filter(p => {
        if (seen.has(p.reddit_id)) return false;
        seen.add(p.reddit_id);
        return true;
    });

    if (uniquePosts.length > 0) {
        db.upsertPosts(uniquePosts);
        log('info', `Saved ${uniquePosts.length} unique posts`, { breakdown: { reddit: redditResults.flat().length, hn: hn.length, github: gh.length, devto: devto.length, anthropic: blog.length, curated: curated.length } });
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

app.get('/api/sources', (req, res) => {
    res.json({
        sources: [
            { id: 'reddit',     name: 'Reddit',        icon: '🔴', description: 'ClaudeAI, claude, claudedev, AnthropicAI, ClaudeCode and more' },
            { id: 'hackernews', name: 'Hacker News',   icon: '🟠', description: 'Top HN stories about Claude, OpenClaw, MoltBot, ClawdBot' },
            { id: 'github',     name: 'GitHub',        icon: '⚫', description: 'Repos for openclaw, clawdbot, moltbot, claude-code' },
            { id: 'devto',      name: 'Dev.to',        icon: '🟣', description: 'Articles tagged claude, anthropic, aitools' },
            { id: 'anthropic',  name: 'Anthropic Blog',icon: '🔵', description: 'Official Anthropic news and releases' },
            { id: 'openclaw',   name: 'OpenClaw',      icon: '🦅', description: 'Official OpenClaw & ClawHub resources' },
            { id: 'moltbot',    name: 'MoltBot',       icon: '🤖', description: 'Official MoltBook resources' },
            { id: 'clawdbot',   name: 'ClawdBot',      icon: '📱', description: 'Official ClawdBot resources' },
        ]
    });
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
