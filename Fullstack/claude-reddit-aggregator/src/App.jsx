import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';

// Debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// Countdown timer hook
function useCountdown(targetTime, onComplete) {
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const diff = Math.max(0, targetTime - now);
            setTimeLeft(diff);
            if (diff === 0 && onComplete) {
                onComplete();
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [targetTime, onComplete]);

    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return { minutes, seconds, timeLeft };
}

// Loading skeleton component
function PostSkeleton() {
    return (
        <div className="glass-card rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-white/20 rounded-full w-24 mb-4"></div>
            <div className="h-5 bg-white/20 rounded-lg w-3/4 mb-3"></div>
            <div className="h-4 bg-white/15 rounded-lg w-full mb-2"></div>
            <div className="h-4 bg-white/15 rounded-lg w-5/6 mb-4"></div>
            <div className="flex justify-between">
                <div className="h-4 bg-white/10 rounded-full w-20"></div>
                <div className="h-4 bg-white/10 rounded-full w-24"></div>
            </div>
        </div>
    );
}

// Trending badge component
function TrendingBadge({ rank }) {
    const colors = {
        1: 'from-yellow-400 to-orange-500',
        2: 'from-gray-300 to-gray-400',
        3: 'from-amber-600 to-amber-700'
    };
    return (
        <div className={`absolute -top-2 -left-2 w-8 h-8 rounded-full bg-gradient-to-br ${colors[rank] || 'from-purple-500 to-pink-500'} flex items-center justify-center text-white text-xs font-bold shadow-lg z-10`}>
            #{rank}
        </div>
    );
}

// Post card component
function PostCard({ post, isFavorite, onToggleFavorite, isSelected, onSelect, showTrending, rank }) {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const excerpt = post.content
        ? post.content.substring(0, 200) + (post.content.length > 200 ? '...' : '')
        : '';

    const subredditColors = {
        'ClaudeAI': 'from-purple-500 to-violet-600',
        'claude': 'from-purple-400 to-purple-600',
        'claudedev': 'from-indigo-500 to-purple-600',
        'AnthropicAI': 'from-pink-500 to-rose-600',
        'OpenAI': 'from-green-500 to-emerald-600',
        'ChatGPT': 'from-teal-500 to-cyan-600',
        'MachineLearning': 'from-blue-500 to-indigo-600',
        'LocalLLaMA': 'from-orange-500 to-amber-600',
        'artificial': 'from-cyan-500 to-blue-600',
        'singularity': 'from-fuchsia-500 to-pink-600',
        'Bard': 'from-yellow-500 to-orange-600',
        'bing': 'from-sky-500 to-blue-600',
        'perplexity_ai': 'from-violet-500 to-purple-600'
    };

    const gradientClass = subredditColors[post.subreddit] || 'from-gray-500 to-gray-600';

    return (
        <article
            className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl cursor-pointer relative group ${isSelected ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-transparent' : ''}`}
            onClick={() => onSelect(post)}
            tabIndex={0}
            role="button"
            aria-label={`View post: ${post.title}`}
        >
            {showTrending && rank <= 3 && <TrendingBadge rank={rank} />}

            {/* Gradient top bar */}
            <div className={`h-1.5 bg-gradient-to-r ${gradientClass}`}></div>

            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${gradientClass} text-white shadow-lg`}>
                        r/{post.subreddit}
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(post.reddit_id);
                        }}
                        className={`p-2 rounded-full transition-all duration-200 ${isFavorite
                            ? 'text-yellow-400 bg-yellow-400/20 hover:bg-yellow-400/30 scale-110'
                            : 'text-gray-400 hover:text-yellow-400 hover:bg-white/10'
                        }`}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <svg className="w-5 h-5 transition-transform" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                    </button>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors mb-2 line-clamp-2 leading-snug">
                    {post.title}
                </h3>

                {excerpt && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-3 leading-relaxed">
                        {excerpt}
                    </p>
                )}

                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                        <span className="flex items-center text-orange-400 font-medium">
                            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                            </svg>
                            {post.upvotes.toLocaleString()}
                        </span>
                        <span className="flex items-center text-blue-400">
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {post.num_comments}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400">
                        <span className="truncate max-w-[100px]">u/{post.author}</span>
                        <span className="text-gray-600">|</span>
                        <span className="text-purple-400">{formatDate(post.created_at)}</span>
                    </div>
                </div>
            </div>

            {/* Hover gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        </article>
    );
}

// Post Modal component
function PostModal({ post, isOpen, onClose, isFavorite, onToggleFavorite }) {
    const modalRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            modalRef.current?.focus();
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !post) return null;

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative glass-card rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden animate-scale-in"
                tabIndex={-1}
            >
                {/* Header gradient */}
                <div className="h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>

                <div className="p-6 overflow-y-auto max-h-[calc(85vh-2rem)]">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-gray-300 hover:text-white"
                        aria-label="Close modal"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Subreddit and actions */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                            r/{post.subreddit}
                        </span>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => onToggleFavorite(post.reddit_id)}
                                className={`p-2 rounded-full transition-all ${isFavorite
                                    ? 'text-yellow-400 bg-yellow-400/20'
                                    : 'text-gray-400 hover:text-yellow-400 hover:bg-white/10'
                                }`}
                            >
                                <svg className="w-6 h-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
                        {post.title}
                    </h2>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
                        <span className="flex items-center text-orange-400 font-semibold">
                            <svg className="w-5 h-5 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                            </svg>
                            {post.upvotes.toLocaleString()} upvotes
                        </span>
                        <span className="flex items-center text-blue-400">
                            <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {post.num_comments} comments
                        </span>
                        <span className="text-gray-400">
                            by <span className="text-purple-400">u/{post.author}</span>
                        </span>
                        <span className="text-gray-500">
                            {formatDate(post.created_at)}
                        </span>
                    </div>

                    {/* Content */}
                    {post.content && (
                        <div className="prose prose-invert max-w-none mb-6">
                            <div className="bg-white/5 rounded-xl p-4 text-gray-300 whitespace-pre-wrap leading-relaxed">
                                {post.content}
                            </div>
                        </div>
                    )}

                    {/* View on Reddit button */}
                    <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full py-3 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-orange-500/25"
                    >
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.8 11.33c.07.25.12.5.12.77 0 2.42-2.81 4.4-6.27 4.4s-6.27-1.98-6.27-4.4c0-.27.05-.52.12-.77-.67-.37-1.1-1.05-1.1-1.83 0-1.1.9-2 2-2 .55 0 1.05.22 1.42.58 1.1-.67 2.52-1.08 4.05-1.13l.85-4.02c.05-.22.27-.37.5-.32l2.87.62c.15-.35.52-.6.95-.6.55 0 1 .45 1 1s-.45 1-1 1c-.47 0-.85-.32-.95-.75l-2.52-.55-.77 3.62c1.52.07 2.93.48 4.02 1.15.37-.37.87-.6 1.42-.6 1.1 0 2 .9 2 2 0 .78-.43 1.46-1.1 1.83zM9.97 12c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm4.06 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm-5.15 4.08c-.13-.13-.13-.33 0-.46.13-.13.35-.13.48 0 .62.6 1.58.95 2.64.95s2.02-.35 2.64-.95c.13-.13.35-.13.48 0 .13.13.13.33 0 .46-.73.73-1.88 1.15-3.12 1.15s-2.39-.42-3.12-1.15z"/>
                        </svg>
                        View on Reddit
                    </a>
                </div>
            </div>
        </div>
    );
}

// Subreddit filter chips
function SubredditChips({ subreddits, selected, onSelect }) {
    return (
        <div className="flex flex-wrap gap-2">
            <button
                onClick={() => onSelect('')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selected === ''
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
            >
                All
            </button>
            {subreddits.map(sub => (
                <button
                    key={sub.name}
                    onClick={() => onSelect(sub.name)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center space-x-1.5 ${
                        selected === sub.name
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                    }`}
                >
                    <span>r/{sub.name}</span>
                    <span className="text-xs opacity-75">({sub.count})</span>
                </button>
            ))}
        </div>
    );
}

// Stats card component
function StatCard({ icon, label, value, color, trend }) {
    return (
        <div className="glass-card rounded-xl p-4 flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                {icon}
            </div>
            <div>
                <p className="text-gray-400 text-sm">{label}</p>
                <p className="text-2xl font-bold text-white">{value}</p>
                {trend && (
                    <p className={`text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}% from yesterday
                    </p>
                )}
            </div>
        </div>
    );
}

// Keyboard shortcuts help
function KeyboardShortcuts({ isOpen, onClose }) {
    if (!isOpen) return null;

    const shortcuts = [
        { key: 'j / k', action: 'Navigate between posts' },
        { key: 'Enter / Space', action: 'Open selected post' },
        { key: 'f', action: 'Toggle favorite' },
        { key: 'Escape', action: 'Close modal / Clear selection' },
        { key: 'r', action: 'Refresh posts' },
        { key: '/', action: 'Focus search' },
        { key: 'd', action: 'Toggle dark mode' },
        { key: '?', action: 'Show keyboard shortcuts' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative glass-card rounded-2xl p-6 max-w-md w-full animate-scale-in">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    Keyboard Shortcuts
                </h3>
                <div className="space-y-3">
                    {shortcuts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <kbd className="px-3 py-1.5 rounded-lg bg-white/10 text-purple-300 font-mono text-sm">
                                {s.key}
                            </kbd>
                            <span className="text-gray-300">{s.action}</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={onClose}
                    className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-opacity"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
}

// Main App component
export default function App() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
    const [favorites, setFavorites] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('reddit-favorites') || '[]');
        } catch {
            return [];
        }
    });
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [connected, setConnected] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [stats, setStats] = useState(null);
    const [darkMode, setDarkMode] = useState(() => {
        try {
            const saved = localStorage.getItem('reddit-dark-mode');
            if (saved !== null) return JSON.parse(saved);
            return true; // Default to dark mode
        } catch {
            return true;
        }
    });
    const [selectedPost, setSelectedPost] = useState(null);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [selectedSubreddit, setSelectedSubreddit] = useState('');
    const [nextRefresh, setNextRefresh] = useState(Date.now() + 300000);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [view, setView] = useState('grid'); // 'grid' or 'trending'

    const searchInputRef = useRef(null);
    const postsContainerRef = useRef(null);

    // Countdown to next refresh
    const { minutes, seconds } = useCountdown(nextRefresh, () => {
        setNextRefresh(Date.now() + 300000);
    });

    // Apply dark mode class to document
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('reddit-dark-mode', JSON.stringify(darkMode));
    }, [darkMode]);

    const debouncedSearch = useDebounce(searchTerm, 300);

    // API URL
    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : '';

    // Socket.IO connection
    useEffect(() => {
        const socket = io(API_URL, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            setConnected(true);
        });

        socket.on('disconnect', () => {
            setConnected(false);
        });

        socket.on('posts-updated', (data) => {
            setLastUpdated(new Date().toISOString());
            setNextRefresh(Date.now() + 300000);
            fetchPosts();
        });

        socket.on('stats', (data) => {
            setStats(data);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Fetch posts
    const fetchPosts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = new URLSearchParams({
                search: debouncedSearch,
                subreddit: selectedSubreddit,
                sortBy,
                sortOrder,
                page: page.toString(),
                limit: '24'
            });

            const response = await fetch(`${API_URL}/api/posts?${params}`);
            if (!response.ok) throw new Error('Failed to fetch posts');

            const data = await response.json();
            if (data.success) {
                setPosts(data.posts);
                setPagination(data.pagination);
                setLastUpdated(data.lastUpdated);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, selectedSubreddit, sortBy, sortOrder, page, API_URL]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Toggle favorite
    const toggleFavorite = useCallback((redditId) => {
        setFavorites(prev => {
            const updated = prev.includes(redditId)
                ? prev.filter(id => id !== redditId)
                : [...prev, redditId];
            localStorage.setItem('reddit-favorites', JSON.stringify(updated));
            return updated;
        });
    }, []);

    // Filtered posts
    const displayedPosts = useMemo(() => {
        if (!showFavoritesOnly) return posts;
        return posts.filter(post => favorites.includes(post.reddit_id));
    }, [posts, favorites, showFavoritesOnly]);

    // Trending posts (top 5 by upvotes)
    const trendingPosts = useMemo(() => {
        return [...posts].sort((a, b) => b.upvotes - a.upvotes).slice(0, 5);
    }, [posts]);

    // Subreddit stats
    const subredditStats = useMemo(() => {
        const counts = {};
        posts.forEach(post => {
            counts[post.subreddit] = (counts[post.subreddit] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [posts]);

    // Handle refresh
    const handleRefresh = async () => {
        try {
            const response = await fetch(`${API_URL}/api/refresh`, { method: 'POST' });
            if (response.ok) {
                fetchPosts();
                setNextRefresh(Date.now() + 300000);
            }
        } catch (err) {
            console.error('Refresh error:', err);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Don't trigger shortcuts when typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') {
                    e.target.blur();
                }
                return;
            }

            switch (e.key) {
                case 'j':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.min(prev + 1, displayedPosts.length - 1));
                    break;
                case 'k':
                    e.preventDefault();
                    setSelectedIndex(prev => Math.max(prev - 1, 0));
                    break;
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (selectedIndex >= 0 && displayedPosts[selectedIndex]) {
                        setSelectedPost(displayedPosts[selectedIndex]);
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    if (selectedIndex >= 0 && displayedPosts[selectedIndex]) {
                        toggleFavorite(displayedPosts[selectedIndex].reddit_id);
                    }
                    break;
                case 'Escape':
                    if (selectedPost) {
                        setSelectedPost(null);
                    } else {
                        setSelectedIndex(-1);
                    }
                    break;
                case 'r':
                    e.preventDefault();
                    handleRefresh();
                    break;
                case '/':
                    e.preventDefault();
                    searchInputRef.current?.focus();
                    break;
                case 'd':
                    e.preventDefault();
                    setDarkMode(prev => !prev);
                    break;
                case '?':
                    e.preventDefault();
                    setShowShortcuts(true);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [displayedPosts, selectedIndex, selectedPost, toggleFavorite]);

    // Scroll selected post into view
    useEffect(() => {
        if (selectedIndex >= 0 && postsContainerRef.current) {
            const cards = postsContainerRef.current.querySelectorAll('article');
            if (cards[selectedIndex]) {
                cards[selectedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-purple-50 to-pink-50'}`}>
            {/* Animated background elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-float-delayed"></div>
            </div>

            {/* Header */}
            <header className="sticky top-0 z-40 glass-card-solid border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Logo and title */}
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 animate-glow">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                                    Claude Reddit Aggregator
                                </h1>
                                <p className="text-sm text-gray-400">Real-time AI news from Reddit</p>
                            </div>
                        </div>

                        {/* Connection status and actions */}
                        <div className="flex items-center space-x-3">
                            {/* Live indicator with countdown */}
                            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium glass-card ${connected ? 'border-green-500/30' : 'border-red-500/30'}`}>
                                <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                                <span className={connected ? 'text-green-400' : 'text-red-400'}>
                                    {connected ? 'Live' : 'Disconnected'}
                                </span>
                                {connected && (
                                    <span className="text-gray-500 text-xs">
                                        | Next refresh: {minutes}:{seconds.toString().padStart(2, '0')}
                                    </span>
                                )}
                            </div>

                            {/* Action buttons */}
                            <button
                                onClick={handleRefresh}
                                className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-purple-400 transition-all hover:scale-105"
                                title="Refresh posts (r)"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>

                            <button
                                onClick={() => setDarkMode(prev => !prev)}
                                className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-yellow-400 transition-all hover:scale-105"
                                title="Toggle dark mode (d)"
                            >
                                {darkMode ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                )}
                            </button>

                            <button
                                onClick={() => setShowShortcuts(true)}
                                className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-purple-400 transition-all hover:scale-105"
                                title="Keyboard shortcuts (?)"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                </svg>
                            </button>

                            <a
                                href="https://github.com/Michaelunkai/claude-reddit-aggregator"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-xl glass-card text-gray-400 hover:text-white transition-all hover:scale-105"
                                title="View on GitHub"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                            label="Total Posts"
                            value={stats.totalPosts?.toLocaleString() || '0'}
                            color="from-purple-500 to-indigo-600"
                        />
                        <StatCard
                            icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            label="Last 24 Hours"
                            value={stats.postsLast24h?.toLocaleString() || '0'}
                            color="from-pink-500 to-rose-600"
                        />
                        <StatCard
                            icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                            label="Last 7 Days"
                            value={stats.postsLastWeek?.toLocaleString() || '0'}
                            color="from-orange-500 to-amber-600"
                        />
                        <StatCard
                            icon={<svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                            label="Favorites"
                            value={favorites.length.toLocaleString()}
                            color="from-yellow-500 to-orange-600"
                        />
                    </div>
                )}

                {/* View Toggle & Filters */}
                <div className="glass-card rounded-2xl p-5 mb-6">
                    {/* View toggle tabs */}
                    <div className="flex items-center space-x-2 mb-5">
                        <button
                            onClick={() => setView('grid')}
                            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${view === 'grid' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            <span className="flex items-center space-x-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                <span>All Posts</span>
                            </span>
                        </button>
                        <button
                            onClick={() => setView('trending')}
                            className={`px-5 py-2.5 rounded-xl font-medium transition-all ${view === 'trending' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                        >
                            <span className="flex items-center space-x-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                </svg>
                                <span>Trending</span>
                            </span>
                        </button>
                    </div>

                    {/* Search and filters */}
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search posts... (press / to focus)"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Sort and filter controls */}
                        <div className="flex gap-2">
                            <select
                                value={sortBy}
                                onChange={(e) => {
                                    setSortBy(e.target.value);
                                    setPage(1);
                                }}
                                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent cursor-pointer"
                            >
                                <option value="created_at" className="bg-gray-800">Newest</option>
                                <option value="upvotes" className="bg-gray-800">Most Upvoted</option>
                                <option value="num_comments" className="bg-gray-800">Most Comments</option>
                            </select>

                            <button
                                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                                className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                            >
                                <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => setShowFavoritesOnly(prev => !prev)}
                                className={`px-5 py-3 rounded-xl transition-all flex items-center space-x-2 ${showFavoritesOnly
                                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg'
                                    : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                <svg className="w-5 h-5" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                                <span className="hidden sm:inline">{favorites.length}</span>
                            </button>
                        </div>
                    </div>

                    {/* Subreddit filter chips */}
                    {subredditStats.length > 0 && (
                        <div className="mt-4 overflow-x-auto pb-2">
                            <SubredditChips
                                subreddits={subredditStats}
                                selected={selectedSubreddit}
                                onSelect={(sub) => {
                                    setSelectedSubreddit(sub);
                                    setPage(1);
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Error State */}
                {error && (
                    <div className="glass-card rounded-2xl p-8 mb-6 text-center border border-red-500/30">
                        <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-red-400 mb-2">Failed to load posts</h3>
                        <p className="text-gray-400 mb-6">{error}</p>
                        <button
                            onClick={fetchPosts}
                            className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <PostSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Trending View */}
                {!loading && !error && view === 'trending' && (
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                            <svg className="w-8 h-8 mr-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                            </svg>
                            Trending Posts
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={postsContainerRef}>
                            {trendingPosts.map((post, index) => (
                                <PostCard
                                    key={post.reddit_id}
                                    post={post}
                                    isFavorite={favorites.includes(post.reddit_id)}
                                    onToggleFavorite={toggleFavorite}
                                    isSelected={selectedIndex === index}
                                    onSelect={setSelectedPost}
                                    showTrending={true}
                                    rank={index + 1}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Posts Grid */}
                {!loading && !error && view === 'grid' && (
                    <>
                        {displayedPosts.length === 0 ? (
                            <div className="text-center py-20">
                                <svg className="w-20 h-20 text-gray-600 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                <h3 className="text-xl font-medium text-gray-400 mb-2">No posts found</h3>
                                <p className="text-gray-500">
                                    {showFavoritesOnly
                                        ? "You haven't favorited any posts yet. Press 'f' on a post to add it!"
                                        : "Try adjusting your search or filters"}
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" ref={postsContainerRef}>
                                {displayedPosts.map((post, index) => (
                                    <PostCard
                                        key={post.reddit_id}
                                        post={post}
                                        isFavorite={favorites.includes(post.reddit_id)}
                                        onToggleFavorite={toggleFavorite}
                                        isSelected={selectedIndex === index}
                                        onSelect={setSelectedPost}
                                        showTrending={false}
                                        rank={index + 1}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.totalPages > 1 && !showFavoritesOnly && (
                            <div className="flex items-center justify-center space-x-4 mt-10">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={!pagination.hasPrev}
                                    className="px-6 py-3 rounded-xl glass-card text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                                >
                                    Previous
                                </button>
                                <span className="text-gray-400 px-4">
                                    Page <span className="text-white font-semibold">{page}</span> of <span className="text-white font-semibold">{pagination.totalPages}</span>
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={!pagination.hasNext}
                                    className="px-6 py-3 rounded-xl glass-card text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="glass-card-solid border-t border-white/10 py-8 mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                            </div>
                            <span className="text-gray-400 text-sm">
                                Claude Reddit Aggregator | Real-time AI news aggregation
                            </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>Auto-refresh every 5 minutes</span>
                            <span>|</span>
                            <span>Posts from last 30 days</span>
                            <span>|</span>
                            <span>Press <kbd className="px-2 py-0.5 rounded bg-white/10 text-purple-400">?</kbd> for shortcuts</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Post Modal */}
            <PostModal
                post={selectedPost}
                isOpen={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                isFavorite={selectedPost ? favorites.includes(selectedPost.reddit_id) : false}
                onToggleFavorite={toggleFavorite}
            />

            {/* Keyboard Shortcuts Modal */}
            <KeyboardShortcuts
                isOpen={showShortcuts}
                onClose={() => setShowShortcuts(false)}
            />
        </div>
    );
}
