import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadConfig, loadEnv } from './config.js';
import { Store } from './store.js';
import { Poller } from './poller.js';

const STATUSES = new Set(['new', 'seen', 'saved', 'applied', 'hidden']);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const PUBLIC = path.join(ROOT, 'public');

export function createServer(poller) {
  const send = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/api/jobs') {
        return send(res, 200, {
          jobs: poller.store.list(),
          lastPoll: poller.lastPoll,
          polling: Boolean(poller.running),
          sources: poller.status,
          config: { keywords: poller.config.keywords, location: poller.config.location, pollMinutes: poller.config.pollMinutes, file: poller.config.file },
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/refresh') {
        const added = await poller.poll();
        return send(res, 200, { added: added.length });
      }
      const m = url.pathname.match(/^\/api\/jobs\/(.+)\/status$/);
      if (req.method === 'POST' && m) {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { status } = JSON.parse(body || '{}');
        if (!STATUSES.has(status)) return send(res, 400, { error: 'bad status' });
        const job = poller.store.setStatus(decodeURIComponent(m[1]), status);
        if (!job) return send(res, 404, { error: 'not found' });
        poller.store.save();
        return send(res, 200, job);
      }
      if (req.method === 'GET') {
        const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
        if (file.startsWith(PUBLIC) && fs.existsSync(file) && fs.statSync(file).isFile()) {
          res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
          return fs.createReadStream(file).pipe(res);
        }
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, 500, { error: e.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv();
  const config = loadConfig();
  const store = new Store(path.join(ROOT, 'data', 'jobs.json'));
  const poller = new Poller({ store, config, env });
  const port = Number(env.PORT) || 3000;
  createServer(poller).listen(port, () => {
    console.log(`JobRadar running at http://localhost:${port}  (config: ${config.file})`);
    console.log(`Checking for new jobs every ${config.pollMinutes} min. Keywords: ${config.keywords.join(', ') || '(any)'}`);
    poller.start();
  });
}
