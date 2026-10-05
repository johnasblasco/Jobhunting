// One-shot fetch: prints jobs found since the last run. Handy for cron / quick checks.
import { loadEnv, loadLocalConfig, fileStore } from './local.js';
import { Poller } from './poller.js';

const env = loadEnv();
const poller = new Poller({ store: fileStore(), config: loadLocalConfig(env), env });
const added = await poller.poll();
for (const [name, s] of Object.entries(poller.status)) {
  console.log(`  ${name.padEnd(15)} ${s.skipped ? `skipped (${s.skipped})` : s.ok ? `${s.count} jobs` : `ERROR ${s.error}`}`);
}
console.log(`\n${added.length} new job(s):\n`);
for (const j of added) {
  console.log(`${j.title} - ${j.company || '?'} (${j.location || 'n/a'}) [${j.via}]\n  ${j.url}\n`);
}
