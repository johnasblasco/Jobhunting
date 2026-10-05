// Jobicy - remote jobs API.
import { fetchJson, stripHtml, toIso, formatSalary, decodeEntities } from '../util.js';

export default {
  name: 'jobicy',
  label: 'Jobicy',
  async fetch() {
    const res = await fetchJson('https://jobicy.com/api/v2/remote-jobs?count=100');
    return (res.jobs || []).map(map);
  },
};

export function map(j) {
  return {
    id: `jobicy:${j.id}`,
    source: 'jobicy',
    via: 'Jobicy',
    title: decodeEntities(j.jobTitle),
    company: j.companyName,
    location: j.jobGeo || 'Remote',
    remote: true,
    url: j.url,
    postedAt: toIso(j.pubDate),
    salary: formatSalary(j.annualSalaryMin, j.annualSalaryMax, j.salaryCurrency, 'yr'),
    type: [].concat(j.jobType || []).join(', '),
    tags: [].concat(j.jobIndustry || []).map(decodeEntities),
    snippet: stripHtml(j.jobExcerpt || j.jobDescription),
  };
}
