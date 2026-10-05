import { normalizeKey } from './util.js';
import { PLACES, ABROAD } from './places.js';

function containsPhrase(haystack, phrase) {
  const p = normalizeKey(phrase);
  return p && ` ${haystack} `.includes(` ${p} `);
}

/** Decide whether a job matches the user's search. */
export function matches(job, config) {
  const titleText = normalizeKey(`${job.title} ${(job.tags || []).join(' ')}`);

  if (config.exclude.some((x) => containsPhrase(normalizeKey(job.title), x))) return false;

  // Local sources (JSearch, Jooble) already searched by keyword server-side.
  if (!job.local && config.keywords.length) {
    // Keyword must hit the title/tags; description alone is too noisy for big remote feeds.
    if (!config.keywords.some((k) => containsPhrase(titleText, k))) return false;
  }
  if (job.remote && !config.includeRemote) return false;
  return locationOk(job, config);
}

/**
 * Re-checks a job already saved, after you change settings (e.g. LOCATION).
 * Keywords aren't re-checked: JSearch/Jooble jobs matched them on the search side.
 */
export function stillWanted(job, config) {
  if (['saved', 'applied'].includes(job.status)) return true;
  if (config.exclude.some((x) => containsPhrase(normalizeKey(job.title), x))) return false;
  if (job.remote && !config.includeRemote) return false;
  return locationOk(job, config);
}

/**
 * With onlyCountry on, a job must be in your country (e.g. Makati, Cebu, "Philippines").
 * Remote jobs also pass when they're open to one of remoteRegions (e.g. "Worldwide", "Asia").
 */
function locationOk(job, config) {
  const want = (config.country || '').toLowerCase();
  if (job.country && want && job.country.toLowerCase() !== want) return false;

  const loc = normalizeKey(job.location);
  const has = (p) => containsPhrase(loc, p);
  const places = PLACES[want] || [];
  if (places[0] && has(places[0])) return true; // e.g. "Philippines, Vietnam"
  if (config.location && has(config.location)) return true;
  if (ABROAD.some(has)) return false; // e.g. "Laguna Hills, CA, United States"
  if (places.some(has)) return true;
  if (job.remote && (config.remoteRegions || []).some(has)) return true;
  return !config.onlyCountry;
}

/** Key used to spot the same posting coming from two different sources. */
export function dedupeKey(job) {
  return `${normalizeKey(job.title)}|${normalizeKey(job.company)}`;
}
