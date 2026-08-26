const state = { data: null, filters: { town: 'Southall', topic: 'All', type: 'All' } };

const $ = sel => document.querySelector(sel);
const timeline = $('#timeline');
const status = $('#status');
const count = $('#itemCount');
const title = $('#timelineTitle');
const healthList = $('#healthList');

const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : 'organisation';
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(d);
};
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function filteredItems() {
  if (!state.data) return [];
  return state.data.items.filter(item => {
    const townOk = state.filters.town === 'All' || item.towns.includes(state.filters.town);
    const topicOk = state.filters.topic === 'All' || item.topics.includes(state.filters.topic);
    const typeOk = state.filters.type === 'All' || item.sourceClass === state.filters.type;
    return townOk && topicOk && typeOk;
  });
}

function render() {
  const items = filteredItems();
  title.textContent = state.filters.town === 'All' ? 'Ealing civic timeline' : `${state.filters.town} civic timeline`;
  count.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;

  if (!items.length) {
    timeline.innerHTML = '<div class="empty">Nothing matches these filters yet.</div>';
    return;
  }

  timeline.innerHTML = items.map(item => `
    <article class="item">
      <div class="item-meta">
        <span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span>
        <div class="item-source">${esc(item.source)}</div>
        <div>${esc(fmtDate(item.publishedAt))}</div>
      </div>
      <div>
        <h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>
        ${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}
        <div class="tags">
          ${item.towns.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
          ${item.topics.map(t => `<span class="tag">${esc(t)}</span>`).join('')}
        </div>
      </div>
    </article>
  `).join('');
}

function renderHealth() {
  const health = state.data?.health ?? [];
  healthList.innerHTML = health.map(h => {
    const healthStatus = h.status || (h.ok ? 'ok' : 'error');
    const upstream = healthStatus === 'blocked' || healthStatus === 'upstream';
    const label = h.ok ? h.itemCount : upstream ? 'upstream' : 'error';
    const dotClass = h.ok ? 'ok' : upstream ? 'blocked' : 'bad';
    const sourceName = h.homepage
      ? `<a class="health-source" href="${esc(h.homepage)}" target="_blank" rel="noopener noreferrer">${esc(h.name)}</a>`
      : esc(h.name);
    return `
      <div class="health-row" title="${esc(h.error || 'Feed fetched successfully')}">
        <span class="health-dot ${dotClass}"></span>
        <span>${sourceName}</span>
        <span class="health-count">${esc(label)}</span>
      </div>
    `;
  }).join('');
}

async function load() {
  status.textContent = 'Loading live sources…';
  try {
    const res = await fetch('/.netlify/functions/feed', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.data = await res.json();
    const good = state.data.health.filter(h => h.ok).length;
    const upstream = state.data.health.filter(h => h.status === 'blocked' || h.status === 'upstream').length;
    const upstreamNote = upstream ? ` · ${upstream} unavailable upstream` : '';
    status.textContent = `Updated ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(state.data.generatedAt))} · ${good}/${state.data.health.length} feeds responding${upstreamNote}`;
    renderHealth();
    render();
  } catch (err) {
    if (window.CIVIC_COMMONS_DEMO) {
      state.data = window.CIVIC_COMMONS_DEMO;
      status.textContent = 'Showing prototype data · live RSS activates when deployed with the server-side feed function';
      renderHealth();
      render();
    } else {
      status.textContent = 'Live feeds are unavailable in this preview.';
      timeline.innerHTML = '<div class="empty">Live feed endpoint unavailable.</div>';
    }
  }
}

$('#townFilter').addEventListener('change', e => { state.filters.town = e.target.value; render(); });
$('#topicFilter').addEventListener('change', e => { state.filters.topic = e.target.value; render(); });
$('#typeFilter').addEventListener('change', e => { state.filters.type = e.target.value; render(); });
$('#refreshButton').addEventListener('click', load);

load();
