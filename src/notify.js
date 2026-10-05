// Optional phone alerts through a Telegram bot.
export async function notifyTelegram(jobs, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !jobs.length) return;
  const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  // Telegram messages max out at 4096 chars, so send in chunks of 10 jobs.
  for (let i = 0; i < jobs.length; i += 10) {
    const lines = jobs.slice(i, i + 10).map(
      (j) =>
        `• <a href="${esc(j.url)}">${esc(j.title)}</a>\n  ${esc(j.company || '?')} · ${esc(j.location || '')} · <i>${esc(j.via)}</i>`,
    );
    const text = `🆕 ${jobs.length} new job${jobs.length > 1 ? 's' : ''}\n\n${lines.join('\n')}`;
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
  }
}
