const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'terminal-secret-token';

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');

  let authenticated = false;
  let ptyProcess = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Handle authentication
      if (data.type === 'auth') {
        if (data.token === AUTH_TOKEN) {
          authenticated = true;
          ws.send(JSON.stringify({ type: 'auth', status: 'success' }));

          // Spawn PTY process after authentication
          const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
          ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: data.cols || 80,
            rows: data.rows || 24,
            cwd: process.env.HOME || process.env.USERPROFILE,
            env: process.env
          });

          // Send PTY output to WebSocket
          ptyProcess.onData((output) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data: output }));
            }
          });

          ptyProcess.onExit(({ exitCode }) => {
            console.log(`PTY exited with code ${exitCode}`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
            }
          });

          console.log('PTY spawned successfully');
        } else {
          ws.send(JSON.stringify({ type: 'auth', status: 'failed' }));
          ws.close();
        }
        return;
      }

      // Require authentication for all other messages
      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
        return;
      }

      // Handle terminal input
      if (data.type === 'input' && ptyProcess) {
        ptyProcess.write(data.data);
      }

      // Handle terminal resize
      if (data.type === 'resize' && ptyProcess) {
        ptyProcess.resize(data.cols, data.rows);
      }

    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Terminal server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
