import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BlobsServer } from '@netlify/blobs/server';
import apiFn from '../netlify/functions/api.mjs';
import pollFn from '../netlify/functions/poll.mjs';
import { SOURCES } from '../src/sources/index.js';

// Runs the real Netlify functions against a local Netlify Blobs server.
let server;
before(async () => {
  server = new BlobsServer({ directory: fs.mkdtempSync(path.join(os.tmpdir(), 'blobs-')), token: 'tok' });
  const { port } = await server.start();
  process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}`, token: 'tok', siteID: 'site' })).toString('base64');
  // The Netlify build runs with your real keys and settings in process.env.
  // Remove them so this test never calls a real API or uses your quota.
  for (const key of Object.keys(process.env)) {
    if (/_KEY$|_TOKEN$|_CHAT_ID$|_INTERVAL_MINUTES$/.test(key)) delete process.env[key];
  }
  for (const key of ['KEYWORDS', 'EXCLUDE', 'LOCATION', 'COUNTRY', 'INCLUDE_REMOTE', 'ONLY_COUNTRY', 'REMOTE_REGIONS', 'KEEP_DAYS', 'POLL_MINUTES']) {
    delete process.env[key];
  }
  Object.assign(process.env, {
    KEYWORDS: 'developer',
    APP_PASSWORD: 'pw',
    // Only remotive (mocked below) runs, including any source added in the future.
    DISABLED_SOURCES: SOURCES.map((s) => s.name).filter((n) => n !== 'remotive').join(','),
  });
});
after(() => server.stop());

const remotive = (jobs) => Response.json({ jobs });
const rJob = (id, title) => ({ id, url: `https://remotive.com/${id}`, title, company_name: 'R', publication_date: new Date().toISOString(), candidate_required_location: 'Worldwide' });
const call = (method, p, body) => apiFn(new Request(`https://site.netlify.app${p}`, { method, headers: { 'x-app-password': 'pw' }, body: body && JSON.stringify(body) }));

test('netlify: scheduled poll stores jobs, API lists them, statuses survive later polls', async (t) => {
  const realFetch = globalThis.fetch;
  let feed = [rJob(1, 'Web Developer'), rJob(2, 'Chef')];
  t.mock.method(globalThis, 'fetch', (url, init) => {
    const { hostname } = new URL(String(url));
    if (hostname === 'remotive.com') return remotive(feed);
    if (hostname === 'localhost') return realFetch(url, init); // local Blobs server
    throw new Error(`test tried to reach the real internet: ${url}`);
  });

  await pollFn();
  let data = await (await call('GET', '/api/jobs')).json();
  assert.deepEqual(data.jobs.map((j) => j.title), ['Web Developer']);
  assert.equal(data.sources.remotive.ok, true);
  assert.ok(data.lastPoll);

  const res = await call('POST', `/api/jobs/${encodeURIComponent('remotive:1')}/status`, { status: 'applied' });
  assert.equal((await res.json()).status, 'applied');

  feed = [rJob(1, 'Web Developer'), rJob(3, 'React Developer')];
  await pollFn(); // remotive is throttled to once per 6h, so nothing new is fetched...
  data = await (await call('GET', '/api/jobs')).json();
  assert.equal(data.jobs.length, 1);
  assert.equal(data.jobs[0].status, 'applied', 'status kept');

  assert.equal((await apiFn(new Request('https://site.netlify.app/api/jobs'))).status, 401, 'password enforced');
});
