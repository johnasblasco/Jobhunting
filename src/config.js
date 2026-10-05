// Settings come from config.json (local runs) and/or environment variables (Netlify).
// Environment variables win, so on Netlify you never need to commit a config file.

export const DEFAULTS = {
  keywords: ['developer', 'software engineer', 'web developer'],
  exclude: [],
  location: 'Philippines',
  country: 'ph',
  includeRemote: true,
  // Remote jobs restricted to other regions (e.g. "USA only") are hidden unless their
  // location mentions one of these. Empty list = show every remote job.
  remoteRegions: ['worldwide', 'anywhere', 'global', 'remote', 'asia', 'apac', 'philippines', 'southeast asia'],
  pollMinutes: 15,
  keepDays: 30,
  sources: { arbeitnow: false },
  // Minimum minutes between checks of a source. JSearch's free plan has a small monthly
  // quota (each check = 1 request per keyword), so by default it's checked every 6 hours.
  // SerpApi's free plan is smaller still, so it's checked twice a day.
  intervals: { jsearch: 360, serpapi: 720 },
};

const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);

export function resolveConfig(fileConfig = {}, env = {}) {
  const cfg = {
    ...DEFAULTS,
    ...fileConfig,
    sources: { ...DEFAULTS.sources, ...fileConfig.sources },
    intervals: { ...DEFAULTS.intervals, ...fileConfig.intervals },
  };
  if (env.KEYWORDS) cfg.keywords = list(env.KEYWORDS);
  if (env.EXCLUDE !== undefined) cfg.exclude = list(env.EXCLUDE);
  if (env.LOCATION !== undefined) cfg.location = env.LOCATION.trim();
  if (env.COUNTRY !== undefined) cfg.country = env.COUNTRY.trim().toLowerCase();
  if (env.INCLUDE_REMOTE !== undefined) cfg.includeRemote = !/^(false|0|no)$/i.test(env.INCLUDE_REMOTE.trim());
  if (env.REMOTE_REGIONS !== undefined) cfg.remoteRegions = list(env.REMOTE_REGIONS);
  if (env.POLL_MINUTES) cfg.pollMinutes = Number(env.POLL_MINUTES) || cfg.pollMinutes;
  if (env.KEEP_DAYS) cfg.keepDays = Number(env.KEEP_DAYS) || cfg.keepDays;
  if (env.JSEARCH_INTERVAL_MINUTES) cfg.intervals.jsearch = Number(env.JSEARCH_INTERVAL_MINUTES) || cfg.intervals.jsearch;
  if (env.SERPAPI_INTERVAL_MINUTES) cfg.intervals.serpapi = Number(env.SERPAPI_INTERVAL_MINUTES) || cfg.intervals.serpapi;
  if (env.JOOBLE_INTERVAL_MINUTES) cfg.intervals.jooble = Number(env.JOOBLE_INTERVAL_MINUTES) || cfg.intervals.jooble;
  if (env.DISABLED_SOURCES !== undefined) {
    for (const name of list(env.DISABLED_SOURCES)) cfg.sources[name] = false;
  }
  cfg.keywords = cfg.keywords.map((k) => k.trim()).filter(Boolean);
  cfg.exclude = cfg.exclude.map((k) => k.trim()).filter(Boolean);
  return cfg;
}
