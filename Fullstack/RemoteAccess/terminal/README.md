# Web Terminal

A real-time web-based terminal that provides remote access to your machine's terminal from anywhere through a browser.

## Repository

**[GitHub Repository](https://github.com/Michaelunkai/terminal)**

## Features

- Real-time terminal access via WebSocket
- Token-based authentication for security
- Full PowerShell/Bash support
- Copy/paste support (Ctrl+C/Ctrl+V)
- Auto-reconnection on connection loss
- Responsive terminal that resizes with browser window
- Modern, dark-themed UI

## Quick Start

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/Michaelunkai/terminal.git
cd terminal
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variables (optional):
```bash
# Windows PowerShell
$env:AUTH_TOKEN = "your-secret-token"
$env:PORT = 3000

# Linux/Mac
export AUTH_TOKEN="your-secret-token"
export PORT=3000
```

4. Start the server:
```bash
npm start
```

5. Open `http://localhost:3000` in your browser

6. Enter the authentication token (default: `terminal-secret-token`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `AUTH_TOKEN` | Authentication token | `terminal-secret-token` |

## Deployment

This app is designed to be deployed on [Render](https://render.com) (free tier).

### Deploy to Render

1. Fork this repository
2. Create a new Web Service on Render
3. Connect your GitHub repository
4. Set environment variables:
   - `AUTH_TOKEN`: Your secure token
5. Deploy!

## Security

- Always use a strong, unique `AUTH_TOKEN` in production
- Use HTTPS in production
- The terminal runs with the permissions of the server process

## Tech Stack

- **Backend**: Node.js, Express, WebSocket (ws), node-pty
- **Frontend**: xterm.js, vanilla JavaScript
- **Styling**: Custom CSS with modern dark theme

## License

MIT
