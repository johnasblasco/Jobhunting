const UA = 'Mozilla/5.0 (compatible; JobRadar/1.0; personal job alerts)';

let defaultTimeoutMs = 20000;

/** Netlify functions have short time limits, so they lower this. */
export function setRequestTimeout(ms) {
  defaultTimeoutMs = ms;
}

async function request(url, { timeoutMs = defaultTimeoutMs, headers = {}, ...opts } = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': UA, Accept: '*/*', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res;
}

export async function fetchJson(url, opts) {
  return (await request(url, opts)).json();
}

export async function fetchText(url, opts) {
  return (await request(url, opts)).text();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s = '') {
  return String(s).replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(html = '', maxLen = 400) {
  const text = decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

/** Accepts ISO strings, RFC 822 dates, unix seconds or ms. Returns ISO string or null. */
export function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  let d;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else {
    d = new Date(String(value).replace(/^(\d{4}-\d\d-\d\d) (\d)/, '$1T$2'));
  }
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatSalary(min, max, currency = '', period = '') {
  const fmt = (n) => Number(n).toLocaleString('en-US');
  const cur = currency ? `${currency} ` : '';
  const per = period ? `/${period}` : '';
  if (min && max && Number(min) !== Number(max)) return `${cur}${fmt(min)} - ${fmt(max)}${per}`;
  if (min || max) return `${cur}${fmt(min || max)}${per}`;
  return '';
}

/** Minimal RSS 2.0 parser, good enough for job feeds. */
export function parseRss(xml) {
  const items = [];
  for (const [, body] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const get = (tag) => {
      const m = body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
      if (!m) return '';
      return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
    };
    items.push({
      title: decodeEntities(get('title')),
      link: decodeEntities(get('link')),
      guid: decodeEntities(get('guid')),
      pubDate: get('pubDate'),
      description: get('description'),
      region: decodeEntities(get('region')),
      category: decodeEntities(get('category')),
      type: decodeEntities(get('type')),
    });
  }
  return items;
}

export function normalizeKey(s = '') {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
