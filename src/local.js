// Helpers for running on your own computer (npm start / npm run fetch).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from './config.js';
import { Store } from './store.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch {
    // no .env file - fine
  }
  return process.env;
}

export function loadLocalConfig(env) {
  const name = ['config.json', 'config.example.json'].find((f) => fs.existsSync(path.join(ROOT, f)));
  const fileConfig = name ? JSON.parse(fs.readFileSync(path.join(ROOT, name), 'utf8')) : {};
  return { ...resolveConfig(fileConfig, env), file: name || 'defaults' };
}

export function fileStore(file = path.join(ROOT, 'data', 'jobs.json')) {
  const jobs = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).jobs || [] : [];
  return new Store(jobs, async (data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
    fs.renameSync(`${file}.tmp`, file);
  });
}
