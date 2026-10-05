// Himalayas - remote jobs API, includes location restrictions per job.
import { fetchJson, stripHtml, toIso, formatSalary } from '../util.js';

export default {
  name: 'himalayas',
  label: 'Himalayas',
  async fetch() {
    const res = await fetchJson('https://himalayas.app/jobs/api?limit=100');
    return (res.jobs || []).map(map);
  },
};

export function map(j) {
  const regions = j.locationRestrictions || [];
  return {
    id: `himalayas:${j.guid || j.applicationLink}`,
    source: 'himalayas',
    via: 'Himalayas',
    title: j.title,
    company: j.companyName,
    location: regions.length ? regions.join(', ') : 'Worldwide',
    remote: true,
    url: j.applicationLink || j.guid,
    postedAt: toIso(j.pubDate),
    salary: formatSalary(j.minSalary, j.maxSalary, j.currency, 'yr'),
    type: j.employmentType || '',
    tags: [...(j.categories || []), ...(j.seniority || [])],
    snippet: stripHtml(j.excerpt || j.description),
  };
}
