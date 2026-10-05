import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matches } from '../src/filter.js';
import { Store } from '../src/store.js';
import { Poller } from '../src/poller.js';
import { createServer } from '../src/server.js';
import { toIso } from '../src/util.js';

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

test('filter: exclude words and region-locked remote jobs', () => {
  assert.ok(!matches(job({ title: 'Senior Developer' }), cfg()));
  assert.ok(!matches(job({ location: 'USA Only' }), cfg()));
  assert.ok(matches(job({ location: 'Asia, Europe' }), cfg()));
  assert.ok(matches(job({ location: 'Philippines' }), cfg()), 'configured location counts');
  assert.ok(!matches(job(), cfg({ includeRemote: false })));
  assert.ok(matches(job({ location: 'USA Only' }), cfg({ remoteRegions: [], location: '' })));
});

test('filter: local sources trust the server-side search', () => {
  assert.ok(matches(job({ title: 'IT Staff', remote: false, location: 'Manila', local: true }), cfg()));
});

test('toIso handles seconds, ms, ISO and "YYYY-MM-DD HH:MM:SS"', () => {
  assert.equal(toIso(1759640000), '2025-10-05T04:53:20.000Z');
  assert.equal(toIso(1759640000000), '2025-10-05T04:53:20.000Z');
  assert.ok(toIso('2025-10-05 03:00:00').startsWith('2025-10-05T'));
  assert.equal(toIso('garbage'), null);
  assert.equal(toIso(null), null);
});

test('store: dedupes by id and by title+company across sources, persists, prunes', () => {
  const file = tmpFile();
  const s = new Store(file);
  const added = s.add([job(), job(), job({ id: 'y:9', source: 'y', title: 'Web  developer!' }), job({ id: 'x:2', title: 'React Developer' })]);
  assert.deepEqual(added.map((j) => j.id), ['x:1', 'x:2']);
  assert.equal(added[0].status, 'new');
  assert.equal(s.add([job()]).length, 0, 'not new the second time');
  s.setStatus('x:2', 'applied');
  s.add([job({ id: 'x:3', title: 'Old Developer', postedAt: '2020-01-01T00:00:00Z' })]);
  s.prune(30);
  assert.ok(!s.jobs.has('x:3'), 'old job pruned');
  s.save();
  const reloaded = new Store(file);
  assert.equal(reloaded.jobs.get('x:2').status, 'applied');
  assert.deepEqual(reloaded.list().map((j) => j.id).sort(), ['x:1', 'x:2']);
});

test('store: list is newest first', () => {
  const s = new Store(tmpFile());
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
  const p = new Poller({ store: new Store(tmpFile()), config: cfg({ sources: { off: false } }), env: {}, sources, log: quiet });
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
    store: new Store(tmpFile()), config: cfg(), log: quiet,
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
    store: new Store(tmpFile()), config: cfg(), env: {}, log: quiet,
    sources: [{ name: 'slow', minIntervalMinutes: 60, fetch: async () => { calls++; return []; } }],
  });
  await p.poll();
  await p.poll();
  assert.equal(calls, 1);
});

test('server: lists jobs, updates status, serves UI', async () => {
  const p = new Poller({ store: new Store(tmpFile()), config: cfg(), env: {}, log: quiet, sources: [{ name: 's', fetch: async () => [job()] }] });
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
