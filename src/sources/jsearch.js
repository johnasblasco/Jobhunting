// JSearch (RapidAPI) - real-time Google for Jobs results: LinkedIn, Indeed, JobStreet,
// Glassdoor, ZipRecruiter, company career pages... Needs RAPIDAPI_KEY.
import { fetchJson, stripHtml, toIso, formatSalary } from '../util.js';

export default {
  name: 'jsearch',
  label: 'JSearch',
  envKey: 'RAPIDAPI_KEY',
  local: true,
  async fetch(config, env) {
    const jobs = [];
    // One request per keyword keeps the free quota usable; only today's posts.
    for (const keyword of config.keywords.slice(0, 5)) {
      const params = new URLSearchParams({
        query: config.location ? `${keyword} in ${config.location}` : keyword,
        page: '1',
        num_pages: '1',
        date_posted: 'today',
      });
      if (config.country) params.set('country', config.country);
      const res = await fetchJson(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: { 'X-RapidAPI-Key': env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      });
      for (const j of res.data || []) jobs.push(map(j));
    }
    return jobs;
  },
};

export function map(j) {
  const location = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(', ');
  return {
    id: `jsearch:${j.job_id}`,
    source: 'jsearch',
    via: j.job_publisher || 'JSearch',
    title: j.job_title,
    company: j.employer_name,
    location: location || (j.job_is_remote ? 'Remote' : ''),
    remote: Boolean(j.job_is_remote),
    url: j.job_apply_link || j.job_google_link,
    postedAt: toIso(j.job_posted_at_timestamp) || toIso(j.job_posted_at_datetime_utc),
    salary: formatSalary(j.job_min_salary, j.job_max_salary, j.job_salary_currency, j.job_salary_period?.toLowerCase()),
    type: j.job_employment_type || '',
    tags: [],
    snippet: stripHtml(j.job_description),
  };
}
