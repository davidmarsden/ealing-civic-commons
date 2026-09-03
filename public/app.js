import { clearFollows, followCount, itemMatchesFollows, itemPlaceScope, loadFollows, stableItemKey } from './follow-store.js';

const initialFollowing = location.hash === '#following';
const state = { data: null, contributions: [], filters: { town: initialFollowing ? 'All' : 'Southall', topic: 'All', type: 'All' }, view: initialFollowing ? 'following' : 'latest' };
const $ = sel => document.querySelector(sel);
const timeline = $('#timeline');
const status = $('#status');
const count = $('#itemCount');
const title = $('#timelineTitle');
const eyebrow = $('#timelineEyebrow');
const healthList = $('#healthList');

const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(d); };
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const itemPath = item => `/items/${stableItemKey(item.id)}`;
const threadId = item => `civic-item:${stableItemKey(item.id)}`;

function contributionStats(item) {
  const entries = state.contributions.filter(entry => entry?.status === 'published' && entry.threadId === threadId(item));
  return { total: entries.length, corrections: entries.filter(entry => entry.type === 'Correction').length };
}

function contributionLabel(stats) {
  if (!stats.total) return '';
  if (stats.corrections === stats.total) return `${stats.corrections} correction${stats.corrections === 1 ? '' : 's'}`;
  if (stats.corrections) return `${stats.corrections} correction${stats.corrections === 1 ? '' : 's'} · ${stats.total} additions`;
  return `${stats.total} addition${stats.total === 1 ? '' : 's'}`;
}

function personalFeedUrl(follows = loadFollows()) {
  const url = new URL('/.netlify/functions/personal-feed', location.origin);
  const mapping = [
    ['item', follows.items],
    ['source', follows.sources],
    ['town', follows.towns],
    ['topic', follows.topics]
  ];
  mapping.forEach(([param, entries]) => (entries || []).forEach(entry => url.searchParams.append(param, entry.id)));
  return url.href;
}

function ensurePersonalFeedTools() {
  let tools = $('#personalFeedTools');
  if (tools) return tools;
  tools = document.createElement('div');
  tools.id = 'personalFeedTools';
  tools.className = 'personal-feed-tools';
  $('#followSummary').insertAdjacentElement('afterend', tools);
  return tools;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

async function submitEmailAlerts(form, follows) {
  const submit = form.querySelector('button[type="submit"]');
  const result = form.querySelector('[data-email-result]');
  submit.disabled = true;
  submit.textContent = 'Sending confirmation…';
  result.textContent = '';
  result.className = 'email-alert-result';

  try {
    const response = await fetch('/.netlify/functions/email-subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.elements.email.value,
        website: form.elements.website.value,
        follows
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    result.textContent = data.message || 'Check your inbox to confirm your alerts.';
    result.classList.add('success');
    form.elements.email.value = '';
  } catch (error) {
    result.textContent = error.message || 'Could not start email alerts. Please try again.';
    result.classList.add('error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Email me updates';
  }
}

function renderPersonalFeedTools(follows, total) {
  const tools = ensurePersonalFeedTools();
  if (!total) {
    tools.innerHTML = '';
    tools.hidden = true;
    return;
  }

  const feedUrl = personalFeedUrl(follows);
  tools.hidden = false;
  tools.innerHTML = `
    <section class="personal-output-block" aria-labelledby="personalRssHeading">
      <div class="personal-feed-heading"><strong id="personalRssHeading"><span class="rss-mini" aria-hidden="true">◔</span> Your personal RSS</strong><span>Portable, chronological, no account. <a href="/rss.html">What is RSS?</a></span></div>
      <div class="personal-feed-actions">
        <button id="copyPersonalFeedButton" type="button">Copy RSS feed URL</button>
        <a href="${esc(feedUrl)}" target="_blank" rel="noopener">Open RSS feed ↗</a>
      </div>
      <small>The feed URL contains the civic things you follow. Anyone with the URL can see those follow choices; it contains no email address or account identifier.</small>
    </section>
    <section class="personal-output-block email-alert-block" aria-labelledby="emailAlertsHeading">
      <div class="personal-feed-heading"><strong id="emailAlertsHeading">Email alerts</strong><span>Future matching updates, checked every 15 minutes.</span></div>
      <form id="emailAlertForm" class="email-alert-form">
        <label for="emailAlertAddress">Email address</label>
        <div class="email-alert-row"><input id="emailAlertAddress" name="email" type="email" autocomplete="email" required placeholder="you@example.org"><button type="submit">Email me updates</button></div>
        <label class="email-honeypot" aria-hidden="true">Website <input name="website" type="text" tabindex="-1" autocomplete="off"></label>
        <div class="email-alert-result" data-email-result aria-live="polite"></div>
      </form>
      <small>Double opt-in. No account. No open or click tracking. Every alert includes a one-click unsubscribe link. Your email address is stored only to deliver these alerts.</small>
    </section>
  `;

  $('#copyPersonalFeedButton').addEventListener('click', async event => {
    const button = event.currentTarget;
    try {
      await copyText(feedUrl);
      const original = button.textContent;
      button.textContent = '✓ RSS URL copied';
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch {
      button.textContent = 'Copy failed — open feed instead';
    }
  });
  $('#emailAlertForm').addEventListener('submit', event => {
    event.preventDefault();
    submitEmailAlerts(event.currentTarget, follows);
  });
}

function filteredItems() {
  if (!state.data) return [];
  const follows = loadFollows();
  return state.data.items.filter(item => {
    const place = itemPlaceScope(item);
    const townOk = state.filters.town === 'All' || (!place.boroughWide && place.towns.includes(state.filters.town));
    const topicOk = state.filters.topic === 'All' || item.topics.includes(state.filters.topic);
    const typeOk = state.filters.type === 'All' || item.sourceClass === state.filters.type;
    const followOk = state.view === 'latest' || itemMatchesFollows(item, follows);
    return townOk && topicOk && typeOk && followOk;
  });
}

function renderFollowSummary() {
  const follows = loadFollows();
  const total = followCount(follows);
  $('#followingBadge').textContent = total ? total : '';
  $('#clearFollowsButton').hidden = total === 0;
  const summary = $('#followSummary');
  if (!total) {
    summary.innerHTML = '<div class="follow-empty">Nothing followed yet. Open any item and follow the story, source, place or topic.</div>';
    renderPersonalFeedTools(follows, total);
    return;
  }
  const labels = { items: 'Stories', sources: 'Sources', towns: 'Places', topics: 'Topics' };
  summary.innerHTML = Object.entries(labels).filter(([type]) => follows[type].length).map(([type, label]) => `<div class="follow-summary-group"><strong>${label}</strong>${follows[type].map(entry => `<span>${esc(entry.label)}</span>`).join('')}</div>`).join('');
  renderPersonalFeedTools(follows, total);
}

function renderViewControls() {
  $('#latestViewButton').classList.toggle('active', state.view === 'latest');
  $('#followingViewButton').classList.toggle('active', state.view === 'following');
  eyebrow.textContent = state.view === 'following' ? 'Following' : 'Latest';
  title.textContent = state.view === 'following' ? 'Your civic timeline' : state.filters.town === 'All' ? 'Ealing civic timeline' : `${state.filters.town} civic timeline`;
}

function render() {
  renderViewControls();
  renderFollowSummary();
  const items = filteredItems();
  count.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  if (!items.length) {
    timeline.innerHTML = state.view === 'following'
      ? '<div class="empty">Nothing in the current feed matches your follows yet. Follow a story, source, place or topic from an item page.</div>'
      : '<div class="empty">Nothing matches these filters yet.</div>';
    return;
  }
  timeline.innerHTML = items.map(item => {
    const stats = contributionStats(item);
    const label = contributionLabel(stats);
    const additions = label ? `<a class="contribution-count" href="${esc(itemPath(item))}#discussion">${esc(label)}</a>` : '';
    const place = itemPlaceScope(item);
    const placeTags = place.boroughWide
      ? '<span class="tag">Borough-wide</span>'
      : place.towns.map(t => `<span class="tag">${esc(t)}</span>`).join('');
    return `<article class="item"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><div class="item-source">${esc(item.source)}</div><div>${esc(fmtDate(item.publishedAt))}</div></div><div><h3><a href="${esc(itemPath(item))}">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}<div class="item-actions"><a href="${esc(itemPath(item))}">Add context →</a>${additions}<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Read original ↗</a></div><div class="tags">${placeTags}${item.topics.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div></div></article>`;
  }).join('');
}

function diagnosticLabel(diagnostic) { const mode = diagnostic.mode === 'browser-compatible' ? 'Retry' : 'Initial request'; const elapsed = Number.isFinite(diagnostic.elapsedMs) ? ` · ${diagnostic.elapsedMs} ms` : ''; return diagnostic.outcome === 'http-response' ? `${mode}: HTTP ${diagnostic.httpStatus}${elapsed}` : `${mode}: ${diagnostic.error || 'transport error'}${elapsed}`; }
function renderHealth() { const health = state.data?.health ?? []; healthList.innerHTML = health.map(h => { const healthStatus = h.status || (h.ok ? 'ok' : 'error'); const upstream = healthStatus === 'blocked' || healthStatus === 'upstream'; const label = h.ok ? h.itemCount : upstream ? 'upstream' : 'error'; const dotClass = h.ok ? 'ok' : upstream ? 'blocked' : 'bad'; const sourceName = h.homepage ? `<a class="health-source" href="${esc(h.homepage)}" target="_blank" rel="noopener noreferrer">${esc(h.name)}</a>` : esc(h.name); const diagnostics = Array.isArray(h.diagnostics) && h.diagnostics.length ? `<div class="health-diagnostics"><strong>Fetch diagnostics</strong>${h.diagnostics.map(d => `<span>${esc(diagnosticLabel(d))}</span>`).join('')}${h.error ? `<span>Result: ${esc(h.error)}</span>` : ''}</div>` : ''; return `<div class="health-entry"><div class="health-row" title="${esc(h.error || 'Feed fetched successfully')}"><span class="health-dot ${dotClass}"></span><span>${sourceName}</span><span class="health-count">${esc(label)}</span></div>${diagnostics}</div>`; }).join(''); }

async function loadContributions() {
  try {
    const res = await fetch('/data/contributions.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.contributions = Array.isArray(data.contributions) ? data.contributions : [];
  } catch {
    state.contributions = [];
  }
  if (state.data) render();
}

async function load() {
  status.textContent = 'Loading live sources…';
  loadContributions();
  try {
    const res = await fetch('/.netlify/functions/combined-feed', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    const good = state.data.health.filter(h => h.ok).length;
    const upstream = state.data.health.filter(h => h.status === 'blocked' || h.status === 'upstream').length;
    status.textContent = `Updated ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(state.data.generatedAt))} · ${good}/${state.data.health.length} feeds responding${upstream ? ` · ${upstream} unavailable upstream` : ''}`;
    renderHealth(); render();
  } catch {
    if (window.CIVIC_COMMONS_DEMO) { state.data = window.CIVIC_COMMONS_DEMO; status.textContent = 'Showing prototype data · live RSS activates when deployed with the server-side feed function'; renderHealth(); render(); }
    else { status.textContent = 'Live feeds are unavailable in this preview.'; timeline.innerHTML = '<div class="empty">Live feed endpoint unavailable.</div>'; }
  }
}

function setView(view) {
  state.view = view;
  if (view === 'following') {
    state.filters = { town: 'All', topic: 'All', type: 'All' };
    $('#townFilter').value = 'All'; $('#topicFilter').value = 'All'; $('#typeFilter').value = 'All';
  }
  history.replaceState(null, '', view === 'following' ? '#following' : '#latest');
  render();
}

$('#townFilter').value = state.filters.town;
$('#townFilter').addEventListener('change', e => { state.filters.town = e.target.value; render(); });
$('#topicFilter').addEventListener('change', e => { state.filters.topic = e.target.value; render(); });
$('#typeFilter').addEventListener('change', e => { state.filters.type = e.target.value; render(); });
$('#refreshButton').addEventListener('click', load);
$('#latestViewButton').addEventListener('click', () => setView('latest'));
$('#followingViewButton').addEventListener('click', () => setView('following'));
document.querySelectorAll('[data-view-link]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); setView(link.dataset.viewLink); document.querySelector('#latest').scrollIntoView(); }));
$('#clearFollowsButton').addEventListener('click', () => { if (confirm('Clear all follows stored in this browser?')) { clearFollows(); render(); } });
window.addEventListener('civic-follows-changed', render);
window.addEventListener('storage', event => { if (event.key === 'civic-commons:follows:v1') render(); });
load();