import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../src/sources/index.js';

// Sample payloads shaped like each API's real response.
const NOW = 1759640000;
const FIXTURES = {
  jsearch: { data: [{ job_id: 'abc', employer_name: 'Acme PH', job_title: 'React Developer', job_apply_link: 'https://ph.linkedin.com/jobs/view/1', job_city: 'Makati', job_country: 'PH', job_posted_at_timestamp: NOW, job_publisher: 'LinkedIn', job_employment_type: 'Full-time', job_is_remote: false, job_description: 'Build <b>stuff</b>', job_min_salary: 40000, job_max_salary: 60000, job_salary_currency: 'PHP', job_salary_period: 'MONTH' }] },
  serpapi: { search_metadata: { status: 'Success' }, jobs_results: [{ title: 'Customer Service Representative', company_name: 'BPO Corp', location: 'Taguig, Philippines', via: 'LinkedIn', description: 'Answer <b>calls</b>', job_id: 'eyJqb2IiOjF9', detected_extensions: { posted_at: '3 hours ago', schedule_type: 'Full-time', salary: '₱25K–₱30K a month' }, apply_options: [{ title: 'LinkedIn', link: 'https://ph.linkedin.com/jobs/view/9' }, { title: 'JobStreet', link: 'https://ph.jobstreet.com/job/9' }], share_link: 'https://www.google.com/search?ibp=htl;jobs' }] },
  jooble: { totalCount: 1, jobs: [{ id: 99, title: 'Web Developer', location: 'Cebu City', snippet: '&nbsp;Great <b>role</b>', salary: '₱30k', source: 'jobstreet.com', type: 'Full-time', link: 'https://jooble.org/desc/99', company: 'Cebu Co', updated: '2025-10-05T08:00:00.000' }] },
  remotive: { jobs: [{ id: 1, url: 'https://remotive.com/1', title: 'Node Engineer', company_name: 'R', category: 'Software Development', job_type: 'full_time', publication_date: '2025-10-05T01:02:03', candidate_required_location: 'Worldwide', salary: '', description: '<p>x</p>' }] },
  remoteok: [{ legal: 'notice' }, { id: '7', epoch: NOW, company: 'OK', position: 'Frontend Developer', tags: ['react'], location: 'Asia', salary_min: 50000, salary_max: 80000, url: 'https://remoteok.com/7', description: 'y' }],
  arbeitnow: { data: [{ slug: 's1', company_name: 'A', title: 'Backend Developer', description: 'z', remote: true, url: 'https://arbeitnow.com/s1', tags: [], job_types: ['full time'], location: 'Berlin', created_at: NOW }] },
  himalayas: { jobs: [{ title: 'Software Engineer', excerpt: 'e', companyName: 'H', locationRestrictions: ['Philippines'], pubDate: NOW, applicationLink: 'https://himalayas.app/x', guid: 'https://himalayas.app/x', categories: ['Engineering'], seniority: ['Mid-level'], minSalary: null, maxSalary: null }] },
  jobicy: { jobs: [{ id: 5, url: 'https://jobicy.com/5', jobTitle: 'Full Stack Developer &amp; Lead', companyName: 'J', jobGeo: 'APAC', jobType: ['full-time'], jobIndustry: ['Dev &amp; Ops'], pubDate: '2025-10-05 03:00:00', jobExcerpt: 'ex' }] },
  weworkremotely: `<?xml version="1.0"?><rss><channel><item><title>WWR Inc: Senior Web Developer</title><region>Anywhere in the World</region><category>Programming</category><type>Full-Time</type><description><![CDATA[<p>desc &amp; more</p>]]></description><pubDate>Sun, 05 Oct 2025 06:00:00 +0000</pubDate><guid>https://weworkremotely.com/jobs/1</guid><link>https://weworkremotely.com/jobs/1</link></item></channel></rss>`,
};

const config = { keywords: ['developer'], location: 'Philippines', country: 'ph' };
const env = { RAPIDAPI_KEY: 'k', JOOBLE_API_KEY: 'k', SERPAPI_KEY: 'k' };

for (const source of SOURCES) {
  test(`${source.name} maps API response to jobs`, async (t) => {
    const fixture = FIXTURES[source.name];
    t.mock.method(globalThis, 'fetch', async () =>
      typeof fixture === 'string' ? new Response(fixture) : Response.json(fixture));
    const jobs = await source.fetch(config, env);
    assert.ok(jobs.length >= 1, 'returns jobs');
    for (const j of jobs) {
      assert.match(j.id, new RegExp(`^${source.name}:`));
      assert.equal(j.source, source.name);
      for (const k of ['title', 'url', 'via']) assert.ok(j[k], `${k} is set`);
      assert.ok(j.postedAt && !Number.isNaN(Date.parse(j.postedAt)), 'postedAt is a valid date');
      assert.equal(typeof j.remote, 'boolean');
      assert.ok(Array.isArray(j.tags));
      assert.doesNotMatch(j.snippet, /<|&nbsp;|&amp;/, 'snippet is plain text');
    }
  });
}

test('remoteok skips the legal notice entry', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(FIXTURES.remoteok));
  const jobs = await SOURCES.find((s) => s.name === 'remoteok').fetch();
  assert.equal(jobs.length, 1);
});

test('jsearch reports the original publisher (e.g. LinkedIn)', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(FIXTURES.jsearch));
  const [job] = await SOURCES.find((s) => s.name === 'jsearch').fetch({ ...config, keywords: ['react'] }, env);
  assert.equal(job.via, 'LinkedIn');
  assert.equal(job.location, 'Makati, PH');
  assert.equal(job.salary, 'PHP 40,000 - 60,000/month');
});

test('weworkremotely splits company from title and decodes entities', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(FIXTURES.weworkremotely));
  const [job] = await SOURCES.find((s) => s.name === 'weworkremotely').fetch();
  assert.equal(job.company, 'WWR Inc');
  assert.equal(job.title, 'Senior Web Developer');
  assert.equal(job.snippet, 'desc & more');
});

test('HTTP errors are thrown so the poller can report them', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('nope', { status: 403 }));
  await assert.rejects(SOURCES.find((s) => s.name === 'remotive').fetch(), /HTTP 403/);
});

test('serpapi: direct apply link, publisher, relative dates and API errors', async (t) => {
  const { relativeToIso } = await import('../src/sources/serpapi.js');
  const now = new Date('2026-10-05T12:00:00Z');
  assert.equal(relativeToIso('3 hours ago', now), '2026-10-05T09:00:00.000Z');
  assert.equal(relativeToIso('an hour ago', now), '2026-10-05T11:00:00.000Z');
  assert.equal(relativeToIso('30+ days ago', now), '2026-09-05T12:00:00.000Z');
  assert.equal(relativeToIso('Just posted', now), now.toISOString());
  assert.equal(relativeToIso(undefined, now), null);

  const src = SOURCES.find((s) => s.name === 'serpapi');
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url) => { urls.push(String(url)); return Response.json(FIXTURES.serpapi); });
  const [job] = await src.fetch({ keywords: ['customer service'], location: 'Philippines', country: 'ph' }, env, now);
  assert.equal(job.url, 'https://ph.linkedin.com/jobs/view/9');
  assert.equal(job.via, 'LinkedIn');
  assert.equal(job.postedAt, '2026-10-05T09:00:00.000Z');
  assert.match(urls[0], /engine=google_jobs/);
  assert.match(urls[0], /q=customer\+service/);
  assert.match(urls[0], /gl=ph/);

  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Invalid API key.' }));
  await assert.rejects(src.fetch({ keywords: ['x'] }, env), /Invalid API key/);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: "Google hasn't returned any results for this query." }));
  assert.deepEqual(await src.fetch({ keywords: ['x'] }, env), [], 'no results is not an error');
});
