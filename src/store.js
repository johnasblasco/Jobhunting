import { dedupeKey } from './filter.js';

/**
 * Remembers every job we've seen and your status for it.
 * `persist` decides where it's saved (a JSON file locally, Netlify Blobs online).
 */
export class Store {
  constructor(jobs = [], persist = null) {
    this.persist = persist;
    this.jobs = new Map(jobs.map((j) => [j.id, j]));
  }

  /** Adds jobs not seen before. Returns the newly added ones. */
  add(jobs, now = new Date()) {
    const known = new Set([...this.jobs.values()].map(dedupeKey));
    const added = [];
    for (const job of jobs) {
      if (!job.id || !job.title || !job.url || this.jobs.has(job.id)) continue;
      const key = dedupeKey(job);
      if (known.has(key)) continue; // same posting from another site
      known.add(key);
      const stored = { ...job, firstSeenAt: now.toISOString(), status: 'new' };
      delete stored.local;
      this.jobs.set(job.id, stored);
      added.push(stored);
    }
    return added;
  }

  setStatus(id, status) {
    const job = this.jobs.get(id);
    if (!job) return null;
    job.status = status;
    return job;
  }

  /** Drop old jobs you didn't save or apply to. */
  prune(keepDays, now = new Date()) {
    const cutoff = now.getTime() - keepDays * 86400000;
    for (const [id, job] of this.jobs) {
      const t = new Date(job.postedAt || job.firstSeenAt).getTime();
      if (t < cutoff && !['saved', 'applied'].includes(job.status)) this.jobs.delete(id);
    }
  }

  /** Newest first: by posting date, falling back to when we first saw it. */
  list() {
    const time = (j) => new Date(j.postedAt || j.firstSeenAt).getTime();
    return [...this.jobs.values()].sort((a, b) => time(b) - time(a));
  }

  async save() {
    await this.persist?.({ jobs: [...this.jobs.values()] });
  }
}
