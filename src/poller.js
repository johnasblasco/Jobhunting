import { SOURCES } from './sources/index.js';
import { matches, stillWanted } from './filter.js';
import { notifyTelegram } from './notify.js';

export class Poller {
  constructor({ store, config, env, sources = SOURCES, log = console, state = {}, saveState = null }) {
    this.store = store;
    this.config = config;
    this.env = env;
    this.sources = sources;
    this.log = log;
    this.status = state.status || {}; // per-source: { ok, count, error, lastRun, skipped }
    this.lastPoll = state.lastPoll || null;
    this.saveState = saveState;
    this.running = null;
    this.timer = null;
  }

  enabledSources() {
    return this.sources.filter((s) => {
      if (this.config.sources[s.name] === false) return false;
      if (s.envKey && !this.env[s.envKey]) {
        this.status[s.name] = { skipped: `set ${s.envKey} in .env to enable` };
        return false;
      }
      return true;
    });
  }

  /**
   * Minutes to wait between checks of a source. For sources with a monthly request
   * limit (JSearch, SerpApi) this is stretched so the month's checks fit the limit.
   */
  intervalFor(s) {
    let interval = this.config.intervals?.[s.name] ?? s.minIntervalMinutes ?? 0;
    const limit = this.config.monthlyLimits?.[s.name];
    if (s.quota && limit) {
      const perCheck = Math.max(1, Math.min(this.config.keywords.length, 5));
      // Keep 10% of the limit spare for retries.
      interval = Math.max(interval, Math.ceil((30 * 1440 * perCheck) / (limit * 0.9)));
    }
    return interval;
  }

  /** Check every source once. Concurrent calls share the same run. `manual` = "Check now". */
  poll({ manual = false } = {}) {
    this.running ??= this.#poll({ manual }).finally(() => (this.running = null));
    return this.running;
  }

  async #poll({ manual }) {
    const now = new Date();
    const firstRun = this.store.jobs.size === 0;
    const due = this.enabledSources().filter((s) => {
      // Limited sources are slow and use your monthly quota: leave them to the schedule.
      if (manual && s.quota) return false;
      const st = this.status[s.name];
      let interval = this.intervalFor(s);
      // A source that failed is retried sooner than its full interval (limited ones: 3h, others: 1h).
      if (st && st.ok === false) interval = Math.min(interval, s.quota ? 180 : 60);
      return !interval || !st?.lastRun || now - new Date(st.lastRun) >= interval * 60000;
    });

    const results = await Promise.allSettled(due.map((s) => s.fetch(this.config, this.env)));
    const fetched = [];
    results.forEach((r, i) => {
      const src = due[i];
      if (r.status === 'fulfilled') {
        const jobs = r.value.map((j) => ({ ...j, local: Boolean(src.local) }));
        fetched.push(...jobs);
        this.status[src.name] = { ok: true, count: jobs.length, lastRun: now.toISOString(), every: this.intervalFor(src) };
      } else {
        this.status[src.name] = { ok: false, error: r.reason?.message || String(r.reason), lastRun: now.toISOString() };
        this.log.warn(`[${src.name}] ${this.status[src.name].error}`);
      }
    });

    const cutoff = now.getTime() - this.config.keepDays * 86400000;
    const relevant = fetched.filter(
      (j) => matches(j, this.config) && (!j.postedAt || new Date(j.postedAt).getTime() >= cutoff),
    );
    const added = this.store.add(relevant, now);
    this.store.prune(this.config.keepDays, now);
    this.store.retain((j) => stillWanted(j, this.config));
    this.lastPoll = now.toISOString();
    await this.store.save();
    await this.saveState?.({ status: this.status, lastPoll: this.lastPoll });
    this.log.log(`[poll] ${fetched.length} fetched, ${relevant.length} matched, ${added.length} new`);

    // Don't blast your phone with the whole backlog on the very first run.
    if (!firstRun && added.length) {
      await notifyTelegram(added, this.env).catch((e) => this.log.warn(`[telegram] ${e.message}`));
    }
    return added;
  }

  start() {
    const tick = () => this.poll().catch((e) => this.log.error('[poll] failed', e));
    tick();
    this.timer = setInterval(tick, Math.max(1, this.config.pollMinutes) * 60000);
  }

  stop() {
    clearInterval(this.timer);
  }
}
