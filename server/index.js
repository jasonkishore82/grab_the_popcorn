// Production server: serves the built app (dist/) and the API routes (Luna, OMDb).
// Usage: npm run build && npm start   (keys come from .env or the environment)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import './env.js';
import { handleLuna } from './luna.js';
import { handleOmdb } from './omdb.js';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const PORT = process.env.PORT || 3000;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/api/luna') return handleLuna(req, res);
  if (path === '/api/omdb') return handleOmdb(req, res);

  const file = normalize(join(DIST, path === '/' ? 'index.html' : path));
  if (!file.startsWith(DIST)) {
    res.statusCode = 403;
    return res.end();
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(await readFile(join(DIST, 'index.html')));
  }
}).listen(PORT, () => console.log(`Grab the Popcorn running at http://localhost:${PORT}`));
