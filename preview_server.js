
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 3000;
const PREVIEW_FILE = path.resolve(process.cwd(), 'myth_preview.html');

const server = http.createServer((req, res) => {
  // Watch for changes to the preview file and refresh
  fs.watchFile(PREVIEW_FILE, { interval: 500 }, (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
      res.end(fs.readFileSync(PREVIEW_FILE));
    }
  });

  if (!fs.existsSync(PREVIEW_FILE)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <style>
        body { font-family: 'Courier New', monospace; background: #1a1a1a; color: #e0e0e0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .container { text-align: center; }
        code { background: #282a36; padding: 0.2rem 0.5rem; border-radius: 4px; color: #ff79c6; }
      </style>
      <div class="container">
        <h1>Preview Not Ready</h1>
        <p>Generate a myth first by running <code>:myth "your seed"</code> in the terminal.</p>
      </div>
    `);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(fs.readFileSync(PREVIEW_FILE));
});

server.listen(PORT, () => {
  console.log(`[preview] Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
    fs.unwatchFile(PREVIEW_FILE);
    process.exit();
});
