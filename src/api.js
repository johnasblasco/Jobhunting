// The JSON API used by the web page. Shared by the local server and the Netlify function.
import { timingSafeEqual } from 'node:crypto';
import { stillWanted } from './filter.js';

const STATUSES = new Set(['new', 'seen', 'saved', 'applied', 'hidden']);
const json = (body, status = 200) => Response.json(body, { status });

function passwordOk(request, password) {
  if (!password) return true;
  const given = Buffer.from(request.headers.get('x-app-password') || '');
  const want = Buffer.from(password);
  return given.length === want.length && timingSafeEqual(given, want);
}

const defaultSetStatus = (store) => async (id, status) => {
  const job = store.setStatus(id, status);
  if (job) await store.save();
  return job;
};

/**
 * Handles /api/* requests. Returns null for anything else.
 * @param {Request} request
 * @param {{ poller, password?: string, setStatus?: (id, status) => Promise<object|null> }} opts
 */
export async function handleApi(request, { poller, password, setStatus }) {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith('/api/')) return null;
  if (!passwordOk(request, password)) return json({ error: 'password required' }, 401);

  if (request.method === 'GET' && pathname === '/api/jobs') {
    const { config } = poller;
    return json({
      jobs: poller.store.list().filter((j) => stillWanted(j, config)),
      lastPoll: poller.lastPoll,
      polling: Boolean(poller.running),
      sources: poller.status,
      config: { keywords: config.keywords, location: config.location || (config.country || '').toUpperCase(), pollMinutes: config.pollMinutes },
    });
  }
  if (request.method === 'POST' && pathname === '/api/refresh') {
    const added = await poller.poll({ manual: true });
    return json({ added: added.length });
  }
  const m = pathname.match(/^\/api\/jobs\/(.+)\/status$/);
  if (request.method === 'POST' && m) {
    const { status } = await request.json().catch(() => ({}));
    if (!STATUSES.has(status)) return json({ error: 'bad status' }, 400);
    const id = decodeURIComponent(m[1]);
    const job = await (setStatus ?? defaultSetStatus(poller.store))(id, status);
    return job ? json(job) : json({ error: 'not found' }, 404);
  }
  return json({ error: 'not found' }, 404);
}
