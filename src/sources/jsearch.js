// JSearch (RapidAPI) - real-time Google for Jobs results: LinkedIn, Indeed, JobStreet,
// Glassdoor, ZipRecruiter, company career pages... Needs RAPIDAPI_KEY.
import { fetchJson, stripHtml, toIso, formatSalary } from '../util.js';

const HOST = 'jsearch.p.rapidapi.com';
// Newest first; '/search' is the old one. Override with JSEARCH_ENDPOINT if JSearch renames it again.
const PATHS = ['/search-v2', '/job-search', '/search-jobs', '/search'];
let workingPath = null;

function params(path, keyword, config) {
  // JSearch docs: put the place in the query ("web developer in chicago") AND set country,
  // otherwise it searches the US. `location` is where Google pretends the search comes from.
  // num_pages=1: each page (up to 10 jobs) costs one request credit.
  const p = new URLSearchParams({
    query: config.location ? `${keyword} in ${config.location}` : keyword,
    num_pages: '1',
    date_posted: 'today',
  });
  if (path === '/search') p.set('page', '1');
  else if (config.location) p.set('location', config.location);
  if (config.country) p.set('country', config.country);
  return p;
}

/** The job list has been at `data` and at `data.jobs` in different versions. */
function jobsIn(res) {
  if (Array.isArray(res?.data)) return res.data;
  return res?.data?.jobs || res?.data?.data || res?.jobs || [];
}

export default {
  name: 'jsearch',
  label: 'JSearch',
  envKey: 'RAPIDAPI_KEY',
  local: true,
  quota: true, // monthly request limit - see monthlyLimits in config.js
  async fetch(config, env) {
    const keywords = config.keywords.slice(0, 5);
    const call = (path, keyword) => fetchJson(`https://${HOST}${path}?${params(path, keyword, config)}`, {
      headers: { 'X-RapidAPI-Key': env.RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST },
    });

    // JSearch renamed its search endpoint (the old /search now answers 404). Find the one
    // that exists with the first keyword, then use it for the rest. 404s don't use quota.
    const candidates = env.JSEARCH_ENDPOINT ? [env.JSEARCH_ENDPOINT] : [...new Set([workingPath, ...PATHS].filter(Boolean))];
    let first;
    for (const path of candidates) {
      try {
        first = await call(path, keywords[0]);
        workingPath = path;
        break;
      } catch (e) {
        if (e.status !== 404) throw e;
        if (path === candidates.at(-1)) {
          throw new Error(`JSearch search endpoint not found (tried ${candidates.join(', ')}). On RapidAPI open JSearch → "Job Search", copy the path from the URL in the code example (like /search-v2) into the JSEARCH_ENDPOINT environment variable.`);
        }
      }
    }

    // One request per keyword (max 5) keeps the free quota usable; only today's posts.
    const results = await Promise.allSettled(keywords.slice(1).map((k) => call(workingPath, k)));
    const pages = [first, ...results.filter((r) => r.status === 'fulfilled').map((r) => r.value)];
    return pages.flatMap((res) => jobsIn(res).map(map));
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
    country: j.job_country || '',
    url: j.job_apply_link || j.job_google_link,
    postedAt: toIso(j.job_posted_at_timestamp) || toIso(j.job_posted_at_datetime_utc),
    salary: formatSalary(j.job_min_salary, j.job_max_salary, j.job_salary_currency, j.job_salary_period?.toLowerCase()),
    type: j.job_employment_type || '',
    tags: [],
    snippet: stripHtml(j.job_description),
  };
}
