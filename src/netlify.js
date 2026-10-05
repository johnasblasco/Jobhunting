// Netlify setup: jobs and state live in Netlify Blobs instead of a local file.
// Your statuses (saved/applied/hidden) are kept in their own blob, so a background
// job check can never overwrite a button you just clicked.
import { getStore } from '@netlify/blobs';
import { resolveConfig } from './config.js';
import { Store } from './store.js';
import { Poller } from './poller.js';
import { setRequestTimeout } from './util.js';

export async function createNetlifyPoller({ timeoutMs }) {
  setRequestTimeout(timeoutMs);
  const blobs = getStore({ name: 'jobradar', consistency: 'strong' });
  const [jobsData, state, statuses] = await Promise.all([
    blobs.get('jobs', { type: 'json' }),
    blobs.get('state', { type: 'json' }),
    blobs.get('statuses', { type: 'json' }),
  ]);
  const jobs = (jobsData?.jobs || []).map((j) => ({ ...j, status: statuses?.[j.id] || j.status }));
  const store = new Store(jobs, (data) => blobs.setJSON('jobs', data));
  const poller = new Poller({
    store,
    config: resolveConfig({}, process.env),
    env: process.env,
    state: state || {},
    saveState: (s) => blobs.setJSON('state', s),
  });

  async function setStatus(id, status) {
    const job = store.setStatus(id, status);
    if (!job) return null;
    const current = (await blobs.get('statuses', { type: 'json' })) || {};
    // Drop statuses of jobs that no longer exist so this blob stays small.
    for (const key of Object.keys(current)) if (!store.jobs.has(key)) delete current[key];
    current[id] = status;
    await blobs.setJSON('statuses', current);
    return job;
  }

  return { poller, setStatus };
}
