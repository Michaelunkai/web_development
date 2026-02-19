# Troubleshooting Guide

## Common Issues

### 1. Reddit API Authentication Failed

**Symptoms:**
- "Failed to get Reddit OAuth token" in logs
- No posts loading

**Solutions:**
1. Verify your `.env` file contains valid credentials:
   ```
   REDDIT_CLIENT_ID=your_actual_client_id
   REDDIT_CLIENT_SECRET=your_actual_secret
   ```
2. Ensure you created a "script" type application at https://www.reddit.com/prefs/apps
3. The app works without credentials (uses public API) but with rate limits

### 2. Port Already in Use

**Symptoms:**
- "EADDRINUSE" error on startup

**Solutions:**
```powershell
# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change PORT in .env
PORT=3001
```

### 3. Build Failures

**Symptoms:**
- Webpack errors during `npm run build`

**Solutions:**
```powershell
# Clear node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Rebuild
npm run build
```

### 4. WebSocket Connection Failed

**Symptoms:**
- "Disconnected" status in UI
- Posts not updating in real-time

**Solutions:**
1. Ensure the backend server is running on port 3000
2. Check browser console for CORS errors
3. Verify firewall isn't blocking WebSocket connections

### 5. No Posts Appearing

**Symptoms:**
- Empty posts list after waiting

**Solutions:**
1. Check `F:\Downloads\claude-reddit-aggregator\logs\server.log` for errors
2. Trigger manual refresh: Click the refresh button in UI
3. Verify internet connection
4. Without Reddit API credentials, public API has rate limits - wait and retry

### 6. Database Errors

**Symptoms:**
- "Error loading database" in logs
- Posts not persisting

**Solutions:**
```powershell
# Check if data directory exists
Test-Path F:\Downloads\claude-reddit-aggregator\data

# Create if missing
New-Item -ItemType Directory -Path F:\Downloads\claude-reddit-aggregator\data -Force

# Restore from backup if corrupted
Copy-Item F:\Downloads\claude-reddit-aggregator\backups\posts-backup-YYYY-MM-DD.json F:\Downloads\claude-reddit-aggregator\data\posts.json
```

### 7. Slow Performance

**Symptoms:**
- UI feels sluggish with many posts

**Solutions:**
1. Reduce posts per page in API calls
2. Clear old posts from database
3. Check system memory usage

### 8. Tailwind CSS Not Working

**Symptoms:**
- Unstyled components

**Solutions:**
```powershell
# Rebuild with fresh CSS
npm run build

# Check tailwind.config.js content paths
```

## Logs Location

- Server logs: `F:\Downloads\claude-reddit-aggregator\logs\server.log`
- Daily reports: `F:\Downloads\claude-reddit-aggregator\logs\daily-report-YYYY-MM-DD.json`

## Backup and Recovery

### Manual Backup
```powershell
Copy-Item F:\Downloads\claude-reddit-aggregator\data\posts.json F:\Downloads\claude-reddit-aggregator\backups\manual-backup.json
```

### Restore from Backup
```powershell
Copy-Item F:\Downloads\claude-reddit-aggregator\backups\posts-backup-2025-01-15.json F:\Downloads\claude-reddit-aggregator\data\posts.json
```

## Getting Help

If you encounter issues not covered here:
1. Check server logs for detailed error messages
2. Open browser DevTools (F12) and check Console tab for frontend errors
3. Verify all environment variables are set correctly
