# Claude Reddit Aggregator

Real-time Reddit aggregator for Claude & AI discussions. Automatically fetches and displays posts from multiple AI-related subreddits with live updates via Socket.IO.

## Live Demo

**[https://claude-reddit-aggregator.onrender.com](https://claude-reddit-aggregator.onrender.com)**

## Features

- **Real-time Updates**: Live data via Socket.IO - posts refresh automatically every 5 minutes
- **Dark Mode**: Toggle between light and dark themes (persisted in localStorage)
- **Multi-Subreddit Aggregation**: Pulls from 13 AI-related subreddits
- **Search & Filter**: Search posts by title, author, or content
- **Sort Options**: Sort by newest, most upvoted, or most comments
- **Favorites**: Save posts locally for quick access
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Pagination**: Browse through hundreds of posts efficiently

## Monitored Subreddits

- r/ClaudeAI, r/claude, r/claudedev, r/AnthropicAI
- r/OpenAI, r/ChatGPT, r/Bard, r/bing
- r/MachineLearning, r/LocalLLaMA, r/artificial
- r/singularity, r/perplexity_ai

## Quick Start

### One-Liner Setup & Run

**Windows (PowerShell):**
```powershell
git clone https://github.com/Michaelunkai/claude-reddit-aggregator.git; cd claude-reddit-aggregator; npm install; npm run build; node server.js
```

**Windows (CMD):**
```cmd
git clone https://github.com/Michaelunkai/claude-reddit-aggregator.git && cd claude-reddit-aggregator && npm install && npm run build && node server.js
```

**Linux/macOS (Bash):**
```bash
git clone https://github.com/Michaelunkai/claude-reddit-aggregator.git && cd claude-reddit-aggregator && npm install && npm run build && node server.js
```

Then open http://localhost:3000 in your browser.

### Stop the Server

**Windows (PowerShell):**
```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Linux/macOS:**
```bash
kill $(lsof -t -i:3000)
```

## Manual Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Michaelunkai/claude-reddit-aggregator.git
   cd claude-reddit-aggregator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the frontend:**
   ```bash
   npm run build
   ```

4. **Start the server:**
   ```bash
   node server.js
   ```

5. **Open in browser:**
   Navigate to http://localhost:3000

## Configuration (Optional)

Create a `.env` file for custom settings:

```env
PORT=3000
POLL_INTERVAL=300000
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_USER_AGENT=ClaudeRedditAggregator/1.0.0
```

**Note:** The app works without Reddit API credentials using the public JSON API. Add credentials for higher rate limits.

## Tech Stack

- **Backend**: Node.js, Express v5, Socket.IO
- **Frontend**: React 18, Tailwind CSS v4
- **Build**: Webpack 5, Babel
- **Database**: JSON file-based (no external DB required)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/posts` | GET | Get paginated posts with search/filter |
| `/api/stats` | GET | Get aggregation statistics |
| `/api/refresh` | POST | Trigger manual refresh |
| `/api/health` | GET | Health check endpoint |

## Project Structure

```
claude-reddit-aggregator/
├── server.js          # Express server with Socket.IO
├── db.js              # JSON database handler
├── src/
│   ├── App.jsx        # React application
│   ├── index.jsx      # Entry point
│   └── styles.css     # Tailwind CSS with dark mode
├── public/
│   ├── index.html     # HTML template
│   └── bundle.js      # Compiled frontend
├── data/
│   └── posts.json     # Posts database
└── backups/           # Daily backups
```

## License

MIT

## Author

[Michaelunkai](https://github.com/Michaelunkai)
