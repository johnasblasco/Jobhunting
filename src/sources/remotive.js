// Remotive - remote jobs, public API. They ask for only a few requests per day, so we throttle it.
import { fetchJson, stripHtml, toIso } from '../util.js';

export default {
  name: 'remotive',
  label: 'Remotive',
  minIntervalMinutes: 360,
  async fetch() {
    const res = await fetchJson('https://remotive.com/api/remote-jobs?limit=200');
    return (res.jobs || []).map(map);
  },
};

export function map(j) {
  return {
    id: `remotive:${j.id}`,
    source: 'remotive',
    via: 'Remotive',
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || 'Remote',
    remote: true,
    url: j.url,
    postedAt: toIso(j.publication_date),
    salary: j.salary || '',
    type: (j.job_type || '').replace(/_/g, ' '),
    tags: [j.category, ...(j.tags || [])].filter(Boolean),
    snippet: stripHtml(j.description),
  };
}
