import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULTS = {
  keywords: [],
  exclude: [],
  location: '',
  country: '',
  includeRemote: true,
  // Remote jobs restricted to other regions (e.g. "USA only") are hidden unless their
  // location mentions one of these. Empty list = show every remote job.
  remoteRegions: ['worldwide', 'anywhere', 'global', 'remote', 'asia', 'apac', 'philippines', 'southeast asia'],
  pollMinutes: 15,
  keepDays: 30,
  sources: {},
};

export function loadEnv() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    // no .env file - fine
  }
  return process.env;
}

export function loadConfig() {
  const file = fs.existsSync(path.join(ROOT, 'config.json'))
    ? path.join(ROOT, 'config.json')
    : path.join(ROOT, 'config.example.json');
  const cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  cfg.keywords = cfg.keywords.map((k) => k.trim()).filter(Boolean);
  cfg.exclude = cfg.exclude.map((k) => k.trim()).filter(Boolean);
  cfg.file = path.relative(ROOT, file);
  return cfg;
}
