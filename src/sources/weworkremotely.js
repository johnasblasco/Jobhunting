// We Work Remotely - public RSS feed.
import { fetchText, parseRss, stripHtml, toIso } from '../util.js';

export default {
  name: 'weworkremotely',
  label: 'We Work Remotely',
  async fetch() {
    return parseRss(await fetchText('https://weworkremotely.com/remote-jobs.rss')).map(map);
  },
};

export function map(item) {
  // Titles look like "Company Name: Job Title"
  const idx = item.title.indexOf(':');
  const company = idx > 0 ? item.title.slice(0, idx).trim() : '';
  const title = idx > 0 ? item.title.slice(idx + 1).trim() : item.title;
  return {
    id: `weworkremotely:${item.guid || item.link}`,
    source: 'weworkremotely',
    via: 'We Work Remotely',
    title,
    company,
    location: item.region || 'Remote',
    remote: true,
    url: item.link,
    postedAt: toIso(item.pubDate),
    salary: '',
    type: item.type || '',
    tags: item.category ? [item.category] : [],
    snippet: stripHtml(item.description),
  };
}
