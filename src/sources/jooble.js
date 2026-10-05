// Jooble - large aggregator with Philippine listings. Needs JOOBLE_API_KEY.
import { fetchJson, stripHtml, toIso } from '../util.js';

export default {
  name: 'jooble',
  label: 'Jooble',
  envKey: 'JOOBLE_API_KEY',
  local: true,
  async fetch(config, env) {
    const res = await fetchJson(`https://jooble.org/api/${encodeURIComponent(env.JOOBLE_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: config.keywords.join(', '),
        location: config.location || '',
        page: '1',
      }),
    });
    return (res.jobs || []).map(map);
  },
};

export function map(j) {
  return {
    id: `jooble:${j.id}`,
    source: 'jooble',
    via: j.source || 'Jooble',
    title: stripHtml(j.title, 200),
    company: j.company || '',
    location: j.location || '',
    remote: /remote|work from home|wfh/i.test(`${j.title} ${j.location}`),
    url: j.link,
    postedAt: toIso(j.updated),
    salary: j.salary || '',
    type: j.type || '',
    tags: [],
    snippet: stripHtml(j.snippet),
  };
}
