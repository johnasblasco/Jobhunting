// Arbeitnow - free job board API (mostly Europe, many remote roles).
import { fetchJson, stripHtml, toIso } from '../util.js';

export default {
  name: 'arbeitnow',
  label: 'Arbeitnow',
  async fetch() {
    const res = await fetchJson('https://www.arbeitnow.com/api/job-board-api');
    return (res.data || []).map(map);
  },
};

export function map(j) {
  return {
    id: `arbeitnow:${j.slug}`,
    source: 'arbeitnow',
    via: 'Arbeitnow',
    title: j.title,
    company: j.company_name,
    location: j.location || (j.remote ? 'Remote' : ''),
    remote: Boolean(j.remote),
    url: j.url,
    postedAt: toIso(j.created_at),
    salary: '',
    type: (j.job_types || []).join(', '),
    tags: j.tags || [],
    snippet: stripHtml(j.description),
  };
}
