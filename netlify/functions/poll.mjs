// Runs on a schedule (see netlify.toml) and checks every source for new jobs.
import { createNetlifyPoller } from '../../src/netlify.js';

export default async () => {
  // Scheduled functions may run for up to 30s.
  const { poller } = await createNetlifyPoller({ timeoutMs: 20000 });
  const added = await poller.poll();
  console.log(`${added.length} new job(s)`);
};
