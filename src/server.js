// Local server: serves the web page and API, and checks for jobs on a timer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadEnv, loadLocalConfig, fileStore } from './local.js';
import { Poller } from './poller.js';
import { handleApi } from './api.js';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const PUBLIC = path.join(ROOT, 'public');

export function createServer(poller, { password } = {}) {
  return http.createServer(async (req, res) => {
    try {
      let body;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = '';
        for await (const chunk of req) body += chunk;
      }
      const request = new Request(new URL(req.url, 'http://localhost'), { method: req.method, headers: req.headers, body });
      const response = await handleApi(request, { poller, password });
      if (response) {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(await response.text());
      }
      const { pathname } = new URL(req.url, 'http://localhost');
      const file = path.join(PUBLIC, pathname === '/' ? 'index.html' : path.normalize(decodeURIComponent(pathname)));
      if (req.method === 'GET' && file.startsWith(PUBLIC + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        return fs.createReadStream(file).pipe(res);
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv();
  const config = loadLocalConfig(env);
  const poller = new Poller({ store: fileStore(), config, env });
  const port = Number(env.PORT) || 3000;
  createServer(poller, { password: env.APP_PASSWORD }).listen(port, () => {
    console.log(`JobRadar running at http://localhost:${port}  (config: ${config.file})`);
    console.log(`Checking for new jobs every ${config.pollMinutes} min. Keywords: ${config.keywords.join(', ') || '(any)'}`);
    poller.start();
  });
}
