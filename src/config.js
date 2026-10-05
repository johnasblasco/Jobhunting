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
};

const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);

export function resolveConfig(fileConfig = {}, env = {}) {
  const cfg = { ...DEFAULTS, ...fileConfig, sources: { ...DEFAULTS.sources, ...fileConfig.sources } };
  if (env.KEYWORDS) cfg.keywords = list(env.KEYWORDS);
  if (env.EXCLUDE !== undefined) cfg.exclude = list(env.EXCLUDE);
  if (env.LOCATION !== undefined) cfg.location = env.LOCATION.trim();
  if (env.COUNTRY !== undefined) cfg.country = env.COUNTRY.trim().toLowerCase();
  if (env.INCLUDE_REMOTE !== undefined) cfg.includeRemote = !/^(false|0|no)$/i.test(env.INCLUDE_REMOTE.trim());
  if (env.REMOTE_REGIONS !== undefined) cfg.remoteRegions = list(env.REMOTE_REGIONS);
  if (env.POLL_MINUTES) cfg.pollMinutes = Number(env.POLL_MINUTES) || cfg.pollMinutes;
  if (env.KEEP_DAYS) cfg.keepDays = Number(env.KEEP_DAYS) || cfg.keepDays;
  if (env.DISABLED_SOURCES !== undefined) {
    for (const name of list(env.DISABLED_SOURCES)) cfg.sources[name] = false;
  }
  cfg.keywords = cfg.keywords.map((k) => k.trim()).filter(Boolean);
  cfg.exclude = cfg.exclude.map((k) => k.trim()).filter(Boolean);
  return cfg;
}
