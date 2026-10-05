// SerpApi Google Jobs - the jobs box from Google search: LinkedIn, Indeed, JobStreet,
// company sites... Needs SERPAPI_KEY (free plan: https://serpapi.com).
import { fetchJson, stripHtml } from '../util.js';

export default {
  name: 'serpapi',
  label: 'Google Jobs (SerpApi)',
  envKey: 'SERPAPI_KEY',
  local: true,
  async fetch(config, env, now = new Date()) {
    // One search per keyword (max 5), so this uses your monthly quota like JSearch does.
    const pages = await Promise.all(
      config.keywords.slice(0, 5).map((keyword) => {
        const params = new URLSearchParams({ engine: 'google_jobs', q: keyword, hl: 'en', api_key: env.SERPAPI_KEY });
        if (config.location) params.set('location', config.location);
        if (config.country) params.set('gl', config.country);
        return fetchJson(`https://serpapi.com/search.json?${params}`);
      }),
    );
    for (const res of pages) if (res.error && !/hasn't returned any results/i.test(res.error)) throw new Error(res.error);
    return pages.flatMap((res) => (res.jobs_results || []).map((j) => map(j, now)));
  },
};

/** Google only gives "3 hours ago" style dates. */
export function relativeToIso(text, now = new Date()) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/just|today|now/.test(t)) return now.toISOString();
  const m = t.match(/(\d+|an?)\+?\s*(minute|hour|day|week|month)/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : 1;
  const unit = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3, month: 30 * 86400e3 }[m[2]];
  return new Date(now.getTime() - n * unit).toISOString();
}

export function map(j, now = new Date()) {
  const ext = j.detected_extensions || {};
  const apply = (j.apply_options || [])[0];
  return {
    id: `serpapi:${j.job_id}`,
    source: 'serpapi',
    via: String(j.via || apply?.title || 'Google Jobs').replace(/^via\s+/i, ''),
    title: j.title,
    company: j.company_name || '',
    location: j.location || '',
    remote: Boolean(ext.work_from_home) || /remote|anywhere|work from home/i.test(j.location || ''),
    url: apply?.link || j.share_link,
    postedAt: relativeToIso(ext.posted_at, now),
    salary: ext.salary || '',
    type: ext.schedule_type || '',
    tags: [],
    snippet: stripHtml(j.description),
  };
}
