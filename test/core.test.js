import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matches } from '../src/filter.js';
import { fileStore } from '../src/local.js';
import { resolveConfig } from '../src/config.js';
import { Poller } from '../src/poller.js';
import { createServer } from '../src/server.js';
import { toIso } from '../src/util.js';
import { handleApi } from '../src/api.js';

const cfg = (over = {}) => ({
  keywords: ['developer', 'react'], exclude: ['senior'], location: 'Philippines', includeRemote: true,
  remoteRegions: ['worldwide', 'anywhere', 'asia'], keepDays: 30, pollMinutes: 15, sources: {}, ...over,
});
const job = (over = {}) => ({
  id: 'x:1', source: 'x', via: 'X', title: 'Web Developer', company: 'Acme', location: 'Worldwide',
  remote: true, url: 'https://e.com/1', postedAt: new Date().toISOString(), tags: [], snippet: '', ...over,
});
const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jobradar-')), 'jobs.json');
const quiet = { log() {}, warn() {}, error() {} };

test('filter: keyword must be in title or tags', () => {
  assert.ok(matches(job(), cfg()));
  assert.ok(matches(job({ title: 'Engineer', tags: ['React'] }), cfg()));
  assert.ok(!matches(job({ title: 'Accountant', snippet: 'work with developers' }), cfg()));
  assert.ok(!matches(job({ title: 'Reactor Operator' }), cfg()), 'whole words only');
});

test('filter: exclude words; remote jobs must be open to your region', () => {
  assert.ok(!matches(job({ title: 'Senior Developer' }), cfg()));
  assert.ok(!matches(job({ location: 'USA Only' }), cfg()));
  assert.ok(matches(job({ location: 'Asia, Europe' }), cfg()));
  assert.ok(matches(job({ location: 'Philippines' }), cfg()), 'configured location counts');
  assert.ok(!matches(job(), cfg({ includeRemote: false })));
  assert.ok(matches(job({ location: 'USA Only' }), cfg({ onlyCountry: false, remoteRegions: [], location: '' })) === false, 'abroad is still abroad');
  assert.ok(matches(job({ location: 'Remote' }), cfg({ onlyCountry: false })));
});

test('filter: only Philippine jobs (the US jobs from the screenshot are dropped)', () => {
  const ph = cfg({ country: 'ph', location: 'Philippines', onlyCountry: true, keywords: ['customer service'], exclude: [] });
  const local = (location, extra = {}) => job({ local: true, remote: false, title: 'Customer Service Representative', location, ...extra });
  // From the screenshot - all US:
  assert.ok(!matches(local('Santa Fe Springs, CA, United States'), ph));
  assert.ok(!matches(local('Jurupa Valley, CA, United States'), ph));
  assert.ok(!matches(local('Palo Alto, CA, United States'), ph));
  assert.ok(!matches(local('Laguna Hills, CA, United States'), ph), 'Filipino-looking city abroad');
  assert.ok(!matches(local('Austin, TX', { country: 'US' }), ph), 'JSearch country code');
  assert.ok(!matches(local(''), ph), 'unknown location');
  // Philippine locations:
  for (const loc of ['Makati, PH', 'Taguig, Metro Manila, Philippines', 'Cebu City', 'Parañaque', 'Quezon City', 'BGC, Taguig', 'Davao City', 'Philippines, Vietnam']) {
    assert.ok(matches(local(loc), ph), loc);
  }
  assert.ok(matches(local('Makati', { country: 'PH' }), ph));
  // Remote:
  const job2 = (o) => job({ title: 'Customer Service Agent', ...o });
  assert.ok(matches(job2({ location: 'Worldwide' }), ph));
  assert.ok(matches(job2({ location: 'Asia, Europe' }), ph));
  assert.ok(!matches(job2({ location: 'Remote' }), ph), 'plain "Remote" is usually US-only');
  assert.ok(!matches(job2({ location: 'United States' }), ph));
  assert.ok(!matches(local('Remote', { remote: true, country: 'US' }), ph));
});

test('poller + API: changing location removes jobs already saved from abroad', async () => {
  const p = new Poller({ store: fileStore(tmpFile()), config: cfg({ country: '', location: '', onlyCountry: false }), env: {}, log: quiet,
    sources: [{ name: 's', local: true, fetch: async () => [job({ id: 'us', title: 'Customer Service', location: 'Palo Alto, CA', remote: false }), job({ id: 'ph', title: 'Customer Service Rep', location: 'Makati', remote: false }), job({ id: 'kept', title: 'CSR', location: 'Austin, TX', remote: false })] }] });
  await p.poll();
  assert.equal(p.store.jobs.size, 3);
  p.store.setStatus('kept', 'applied');
  p.config = cfg({ country: 'ph', location: 'Philippines', onlyCountry: true });
  const res = await handleApi(new Request('http://x/api/jobs'), { poller: p });
  assert.deepEqual((await res.json()).jobs.map((j) => j.id).sort(), ['kept', 'ph'], 'hidden right away');
  p.sources = [];
  await p.poll();
  assert.deepEqual([...p.store.jobs.keys()].sort(), ['kept', 'ph'], 'and deleted on next check (applied ones kept)');
});

test('toIso handles seconds, ms, ISO and "YYYY-MM-DD HH:MM:SS"', () => {
  assert.equal(toIso(1759640000), '2025-10-05T04:53:20.000Z');
  assert.equal(toIso(1759640000000), '2025-10-05T04:53:20.000Z');
  assert.ok(toIso('2025-10-05 03:00:00').startsWith('2025-10-05T'));
  assert.equal(toIso('garbage'), null);
  assert.equal(toIso(null), null);
});

test('store: dedupes by id and by title+company across sources, persists, prunes', async () => {
  const file = tmpFile();
  const s = fileStore(file);
  const added = s.add([job(), job(), job({ id: 'y:9', source: 'y', title: 'Web  developer!' }), job({ id: 'x:2', title: 'React Developer' })]);
  assert.deepEqual(added.map((j) => j.id), ['x:1', 'x:2']);
  assert.equal(added[0].status, 'new');
  assert.equal(s.add([job()]).length, 0, 'not new the second time');
  s.setStatus('x:2', 'applied');
  s.add([job({ id: 'x:3', title: 'Old Developer', postedAt: '2020-01-01T00:00:00Z' })]);
  s.prune(30);
  assert.ok(!s.jobs.has('x:3'), 'old job pruned');
  await s.save();
  const reloaded = fileStore(file);
  assert.equal(reloaded.jobs.get('x:2').status, 'applied');
  assert.deepEqual(reloaded.list().map((j) => j.id).sort(), ['x:1', 'x:2']);
});

test('store: list is newest first', () => {
  const s = fileStore(tmpFile());
  s.add([
    job({ id: 'a', title: 'A Developer', postedAt: '2025-10-01T00:00:00Z' }),
    job({ id: 'b', title: 'B Developer', postedAt: '2025-10-03T00:00:00Z' }),
    job({ id: 'c', title: 'C Developer', postedAt: null }),
  ]);
  assert.deepEqual(s.list().map((j) => j.id), ['c', 'b', 'a']);
});

test('poller: collects from sources, isolates failures, skips missing keys', async () => {
  const sources = [
    { name: 'good', fetch: async () => [job(), job({ id: 'x:2', title: 'Plumber' })] },
    { name: 'broken', fetch: async () => { throw new Error('boom'); } },
    { name: 'keyed', envKey: 'SECRET', fetch: async () => { throw new Error('should not run'); } },
    { name: 'off', fetch: async () => { throw new Error('should not run'); } },
  ];
  const p = new Poller({ store: fileStore(tmpFile()), config: cfg({ sources: { off: false } }), env: {}, sources, log: quiet });
  const added = await p.poll();
  assert.deepEqual(added.map((j) => j.id), ['x:1']);
  assert.deepEqual(p.status.good, { ok: true, count: 2, lastRun: p.status.good.lastRun });
  assert.equal(p.status.broken.error, 'boom');
  assert.match(p.status.keyed.skipped, /SECRET/);
  assert.equal(p.status.off, undefined);
});

test('poller: sends Telegram only for new jobs after the first run', async (t) => {
  let batch = [job()];
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { sent.push(JSON.parse(init.body).text); return Response.json({ ok: true }); });
  const p = new Poller({
    store: fileStore(tmpFile()), config: cfg(), log: quiet,
    env: { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' },
    sources: [{ name: 's', fetch: async () => batch }],
  });
  await p.poll();
  assert.equal(sent.length, 0, 'no alert for initial backlog');
  batch = [job(), job({ id: 'x:2', title: 'React Developer <Remote>' })];
  await p.poll();
  assert.equal(sent.length, 1);
  assert.match(sent[0], /1 new job/);
  assert.match(sent[0], /React Developer &lt;Remote&gt;/);
});

test('poller: respects a source minIntervalMinutes', async () => {
  let calls = 0;
  const p = new Poller({
    store: fileStore(tmpFile()), config: cfg(), env: {}, log: quiet,
    sources: [{ name: 'slow', minIntervalMinutes: 60, fetch: async () => { calls++; return []; } }],
  });
  await p.poll();
  await p.poll();
  assert.equal(calls, 1);
});

test('poller: config.intervals overrides a source interval', async () => {
  let calls = 0;
  const p = new Poller({
    store: fileStore(tmpFile()), config: cfg({ intervals: { fast: 60 } }), env: {}, log: quiet,
    sources: [{ name: 'fast', fetch: async () => { calls++; return []; } }],
  });
  await p.poll();
  await p.poll();
  assert.equal(calls, 1);
});

test('server: lists jobs, updates status, serves UI', async () => {
  const p = new Poller({ store: fileStore(tmpFile()), config: cfg(), env: {}, log: quiet, sources: [{ name: 's', fetch: async () => [job()] }] });
  const server = createServer(p).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    assert.deepEqual(await (await fetch(`${base}/api/refresh`, { method: 'POST' })).json(), { added: 1 });
    const list = await (await fetch(`${base}/api/jobs`)).json();
    assert.equal(list.jobs.length, 1);
    const upd = await fetch(`${base}/api/jobs/${encodeURIComponent('x:1')}/status`, { method: 'POST', body: JSON.stringify({ status: 'saved' }) });
    assert.equal((await upd.json()).status, 'saved');
    const bad = await fetch(`${base}/api/jobs/x%3A1/status`, { method: 'POST', body: JSON.stringify({ status: 'nope' }) });
    assert.equal(bad.status, 400);
    const html = await fetch(`${base}/`);
    assert.match(await html.text(), /JobRadar/);
    assert.equal((await fetch(`${base}/..%2Fpackage.json`)).status, 404);
  } finally {
    server.close();
  }
});

test('config: environment variables override the file (for Netlify)', () => {
  const c = resolveConfig({ keywords: ['a'], sources: { remotive: true } }, {
    KEYWORDS: 'virtual assistant, data entry ', EXCLUDE: '', LOCATION: 'Cebu', COUNTRY: 'PH',
    INCLUDE_REMOTE: 'false', DISABLED_SOURCES: 'remotive,jobicy', KEEP_DAYS: '7',
  });
  assert.deepEqual(c.keywords, ['virtual assistant', 'data entry']);
  assert.deepEqual(c.exclude, []);
  assert.equal(c.location, 'Cebu');
  assert.equal(c.country, 'ph');
  assert.equal(c.includeRemote, false);
  assert.equal(c.keepDays, 7);
  assert.equal(c.sources.remotive, false);
  assert.equal(c.sources.jobicy, false);
  assert.equal(resolveConfig({}, {}).intervals.jsearch, 360);
  assert.equal(resolveConfig({}, { JSEARCH_INTERVAL_MINUTES: '120' }).intervals.jsearch, 120);
  assert.deepEqual(resolveConfig({}, {}).keywords, ['developer', 'software engineer', 'web developer']);
});

test('server: APP_PASSWORD protects the API', async () => {
  const p = new Poller({ store: fileStore(tmpFile()), config: cfg(), env: {}, log: quiet, sources: [] });
  const server = createServer(p, { password: 's3cret' }).listen(0);
  const base = `http://localhost:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/jobs`)).status, 401);
    assert.equal((await fetch(`${base}/api/jobs`, { headers: { 'x-app-password': 'nope' } })).status, 401);
    assert.equal((await fetch(`${base}/api/jobs`, { headers: { 'x-app-password': 's3cret' } })).status, 200);
    assert.equal((await fetch(`${base}/`)).status, 200, 'page itself loads so it can ask for the password');
  } finally {
    server.close();
  }
});

test('errors explain what the service said, and failed sources retry within the hour', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'You are not subscribed to this API.' }, { status: 403 }));
  const { fetchJson } = await import('../src/util.js');
  await assert.rejects(fetchJson('https://jsearch.p.rapidapi.com/search'), (e) => {
    assert.match(e.message, /HTTP 403 from jsearch\.p\.rapidapi\.com/);
    assert.match(e.message, /not subscribed to the free plan/);
    assert.match(e.message, /"You are not subscribed to this API\."/);
    return true;
  });

  let calls = 0;
  const p = new Poller({
    store: fileStore(tmpFile()), config: cfg({ intervals: { q: 360 } }), env: {}, log: quiet,
    sources: [{ name: 'q', fetch: async () => { calls++; throw new Error('HTTP 500'); } }],
  });
  await p.poll();
  p.status.q.lastRun = new Date(Date.now() - 61 * 60000).toISOString();
  await p.poll();
  assert.equal(calls, 2, 'retried after an hour, not 6 hours');
});
