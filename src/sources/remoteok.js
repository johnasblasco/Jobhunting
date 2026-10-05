// Remote OK - public JSON feed of remote jobs.
import { fetchJson, stripHtml, toIso, formatSalary } from '../util.js';

export default {
  name: 'remoteok',
  label: 'Remote OK',
  async fetch() {
    const res = await fetchJson('https://remoteok.com/api');
    // First element is a legal notice, not a job.
    return (Array.isArray(res) ? res : []).filter((j) => j && j.id && j.position).map(map);
  },
};

export function map(j) {
  return {
    id: `remoteok:${j.id}`,
    source: 'remoteok',
    via: 'Remote OK',
    title: j.position,
    company: j.company,
    location: j.location || 'Remote',
    remote: true,
    url: j.url || j.apply_url,
    postedAt: toIso(j.epoch) || toIso(j.date),
    salary: formatSalary(j.salary_min, j.salary_max, 'USD', 'yr'),
    type: '',
    tags: j.tags || [],
    snippet: stripHtml(j.description),
  };
}
