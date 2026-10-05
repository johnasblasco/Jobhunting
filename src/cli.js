// One-shot fetch: prints jobs found since the last run. Handy for cron / quick checks.
import path from 'node:path';
import { ROOT, loadConfig, loadEnv } from './config.js';
import { Store } from './store.js';
import { Poller } from './poller.js';

const poller = new Poller({
  store: new Store(path.join(ROOT, 'data', 'jobs.json')),
  config: loadConfig(),
  env: loadEnv(),
});
const added = await poller.poll();
for (const [name, s] of Object.entries(poller.status)) {
  console.log(`  ${name.padEnd(15)} ${s.skipped ? `skipped (${s.skipped})` : s.ok ? `${s.count} jobs` : `ERROR ${s.error}`}`);
}
console.log(`\n${added.length} new job(s):\n`);
for (const j of added) {
  console.log(`${j.title} - ${j.company || '?'} (${j.location || 'n/a'}) [${j.via}]\n  ${j.url}\n`);
}
