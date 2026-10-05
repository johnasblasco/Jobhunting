import { normalizeKey } from './util.js';

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
  if (job.remote && !job.local) {
    if (!config.includeRemote) return false;
    const regions = [...(config.remoteRegions || []), config.location].filter(Boolean);
    if (regions.length && job.location) {
      const loc = normalizeKey(job.location);
      if (!regions.some((r) => containsPhrase(loc, r))) return false;
    }
  }
  return true;
}

/** Key used to spot the same posting coming from two different sources. */
export function dedupeKey(job) {
  return `${normalizeKey(job.title)}|${normalizeKey(job.company)}`;
}
