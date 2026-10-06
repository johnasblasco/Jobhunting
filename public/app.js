const $ = (sel) => document.querySelector(sel);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// Optional password (APP_PASSWORD on the server) so strangers can't use your site.
let locked = false;
async function api(path, opts = {}) {
  if (locked) throw new Error('password required');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(path, { ...opts, headers: { ...opts.headers, 'x-app-password': store.get('password', '') } });
    if (res.status !== 401) return res;
    const pw = prompt(attempt ? 'Wrong password, try again:' : 'Enter your JobRadar password:');
    if (pw === null) { locked = true; break; }
    store.set('password', pw);
  }
  throw new Error('password required');
}

let jobs = [];
let data = null;
let tab = store.get('tab', 'inbox');
let knownIds = null; // ids seen while this page is open, to detect arrivals
const freshSince = store.get('lastVisit', 0); // jobs found after your last visit get a NEW badge
addEventListener('pagehide', () => store.set('lastVisit', Date.now()));

const DAY = 86400000;
const time = (j) => new Date(j.postedAt || j.firstSeenAt).getTime();
const isFresh = (j) => new Date(j.firstSeenAt).getTime() > freshSince && j.status === 'new';

const TABS = {
  inbox: (j) => !['hidden', 'applied'].includes(j.status),
  today: (j) => j.status !== 'hidden' && Date.now() - time(j) < DAY,
  local: (j) => j.status !== 'hidden' && !j.remote,
  remote: (j) => j.status !== 'hidden' && j.remote,
  saved: (j) => j.status === 'saved',
  applied: (j) => j.status === 'applied',
  hidden: (j) => j.status === 'hidden',
};

function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function card(j) {
  const t = time(j);
  const hot = Date.now() - t < 2 * 3600000;
  const btn = (status, label) =>
    `<button data-id="${esc(j.id)}" data-status="${j.status === status ? 'seen' : status}" class="${j.status === status ? 'on' : ''}">${label}</button>`;
  return `<article class="job ${isFresh(j) ? 'fresh' : ''}">
    <h2>${isFresh(j) ? '<span class="badge">NEW</span>' : ''}<a href="${esc(j.url)}" target="_blank" rel="noopener" data-open="${esc(j.id)}">${esc(j.title)}</a></h2>
    <div class="sub">
      <span class="age ${hot ? 'hot' : ''}" title="${j.postedAt ? 'Posted' : 'First seen'} ${new Date(t).toLocaleString()}">${j.postedAt ? '' : 'seen '}${ago(t)}</span>
      <span>🏢 ${esc(j.company || 'Unknown company')}</span>
      <span>📍 ${esc(j.location || (j.remote ? 'Remote' : 'n/a'))}</span>
      ${j.salary ? `<span>💰 ${esc(j.salary)}</span>` : ''}
      ${j.type ? `<span>${esc(j.type)}</span>` : ''}
      <span>via ${esc(j.via)}</span>
    </div>
    ${j.snippet ? `<p class="snippet">${esc(j.snippet)}</p>` : ''}
    <div class="actions">
      <a class="apply" href="${esc(j.url)}" target="_blank" rel="noopener" data-open="${esc(j.id)}">Apply →</a>
      ${btn('saved', '★ Save')}
      ${btn('applied', '✓ Applied')}
      ${btn('hidden', '✕ Hide')}
    </div>
  </article>`;
}

function render() {
  const q = $('#q').value.trim().toLowerCase();
  const filtered = jobs.filter(TABS[tab]).filter(
    (j) => !q || `${j.title} ${j.company} ${j.location} ${j.via} ${(j.tags || []).join(' ')}`.toLowerCase().includes(q),
  );
  $('#list').innerHTML = filtered.length
    ? filtered.slice(0, 300).map(card).join('')
    : `<div class="empty">${jobs.length ? 'No jobs in this view.' : 'No jobs yet - first check is running. This page updates automatically.'}</div>`;

  for (const b of $('#tabs').children) {
    b.classList.toggle('active', b.dataset.tab === tab);
    const n = jobs.filter(TABS[b.dataset.tab]).length;
    b.innerHTML = `${b.textContent.replace(/\s*\d+$/, '')}<span class="count">${n}</span>`;
  }
  if (!data) return;
  const fresh = jobs.filter(isFresh).length;
  document.title = fresh ? `(${fresh}) JobRadar` : 'JobRadar';
  $('#meta').textContent = `${data.config.keywords.join(', ') || 'all jobs'}${data.config.location ? ` · ${data.config.location}` : ''} · ` +
    (data.polling ? 'checking now…' : data.lastPoll ? `last checked ${ago(new Date(data.lastPoll))}` : 'waiting for first check');
  const entries = Object.entries(data.sources);
  $('#sources').innerHTML = 'Sources: ' + entries.map(([name, s]) =>
    s.skipped ? `<span title="${esc(s.skipped)}">${esc(name)}: off</span>`
      : s.ok ? `<span>${esc(name)}: ${s.count} ✓${s.every >= 120 ? ` <i>(every ${Math.round(s.every / 60)}h)</i>` : ''}</span>`
      : `<span class="err">${esc(name)}: error ⚠</span>`).join('') +
    entries.filter(([, s]) => s.ok === false).map(([name, s]) =>
      `<div class="err-detail"><b>${esc(name)}:</b> ${esc(s.error)}${s.lastRun ? ` <i>(${ago(new Date(s.lastRun))})</i>` : ''}</div>`).join('');
}

async function load() {
  try {
    const res = await api('/api/jobs');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    $('#meta').textContent = e.message === 'password required' ? 'Password required - reload the page to try again.'
      : `Cannot reach the JobRadar server (${e.message}).`;
    return;
  }
  jobs = data.jobs;
  if (knownIds) {
    const arrived = jobs.filter((j) => !knownIds.has(j.id));
    if (arrived.length) alertNew(arrived);
  }
  knownIds = new Set(jobs.map((j) => j.id));
  render();
}

function alertNew(arrived) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(`${arrived.length} new job${arrived.length > 1 ? 's' : ''}`, {
    body: arrived.slice(0, 4).map((j) => `${j.title} - ${j.company || '?'}`).join('\n'),
    tag: 'jobradar',
  });
  n.onclick = () => { focus(); n.close(); };
}

async function setStatus(id, status) {
  const res = await api(`/api/jobs/${encodeURIComponent(id)}/status`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  });
  if (res.ok) {
    const updated = await res.json();
    jobs = jobs.map((j) => (j.id === id ? updated : j));
    render();
  }
}

$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-status]');
  if (b) return setStatus(b.dataset.id, b.dataset.status);
  const a = e.target.closest('a[data-open]');
  const job = a && jobs.find((j) => j.id === a.dataset.open);
  if (job && job.status === 'new') setStatus(job.id, 'seen');
});
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  store.set('tab', tab);
  render();
});
$('#q').addEventListener('input', render);
$('#refresh').addEventListener('click', async (e) => {
  e.target.disabled = true;
  e.target.textContent = '↻ Checking…';
  try { await api('/api/refresh', { method: 'POST' }); } catch { /* shown on next load */ } finally {
    e.target.disabled = false;
    e.target.textContent = '↻ Check now';
    load();
  }
});
$('#notify').addEventListener('click', async () => {
  if (!('Notification' in window)) return alert('This browser does not support notifications.');
  const p = await Notification.requestPermission();
  $('#notify').textContent = p === 'granted' ? '🔔 Alerts on' : '🔕 Alerts blocked';
});
if ('Notification' in window && Notification.permission === 'granted') $('#notify').textContent = '🔔 Alerts on';
if (!TABS[tab]) tab = 'inbox';

load();
setInterval(load, 60000);
