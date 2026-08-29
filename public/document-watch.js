const $ = sel => document.querySelector(sel);
const state = { data: null, filters: { town: 'All', topic: 'All', category: 'All', thisWeek: false } };
const timeline = $('#watchTimeline');
const status = $('#watchStatus');
const count = $('#watchCount');

const esc = value => String(value ?? '').replace(/[&<>'\"]/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;' }[ch]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(d);
};
const stableItemKey = id => {
  const bytes = new TextEncoder().encode(String(id ?? ''));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
};

function populateCategories(items) {
  const select = $('#watchCategory');
  const current = select.value;
  const categories = [...new Set(items.map(item => item.documentCategory).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  select.innerHTML = '<option value="All">All collections</option>' + categories.map(category => `<option>${esc(category)}</option>`).join('');
  select.value = categories.includes(current) ? current : 'All';
}

function setCategoryFilter(category) {
  state.filters.category = category || 'All';
  $('#watchCategory').value = state.filters.category;
  render();
  document.querySelector('.watch-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filteredItems() {
  const items = state.data?.items || [];
  const weekAgo = Date.now() - 7 * 86400000;
  return items.filter(item => {
    const townOk = state.filters.town === 'All'
      || (state.filters.town === 'Borough-wide' ? item.boroughWide === true : (item.towns || []).includes(state.filters.town));
    const topicOk = state.filters.topic === 'All' || (item.topics || []).includes(state.filters.topic);
    const categoryOk = state.filters.category === 'All' || item.documentCategory === state.filters.category;
    const weekOk = !state.filters.thisWeek || (item.publishedAt && Date.parse(item.publishedAt) >= weekAgo);
    return townOk && topicOk && categoryOk && weekOk;
  });
}

function bindCategoryButtons(root = document) {
  root.querySelectorAll('[data-watch-category]').forEach(button => button.addEventListener('click', () => setCategoryFilter(button.dataset.watchCategory)));
}

function renderHealth() {
  const feeds = state.data?.diagnostics?.feeds || [];
  $('#watchHealth').innerHTML = feeds.map(feed => `<div class="watch-health-row"><span class="watch-health-dot ${esc(feed.freshness)}"></span><button class="watch-health-category" type="button" data-watch-category="${esc(feed.label)}">${esc(feed.label)}</button><span class="watch-health-state">${esc(feed.freshness)}</span></div>`).join('');
  bindCategoryButtons($('#watchHealth'));
}

function render() {
  const items = filteredItems();
  count.textContent = `${items.length} document${items.length === 1 ? '' : 's'}`;
  $('#watchThisWeek').textContent = state.filters.thisWeek ? '✓ New this week' : 'New this week';
  if (!items.length) {
    timeline.innerHTML = '<div class="empty">No council documents match these filters.</div>';
    return;
  }
  timeline.innerHTML = items.map(item => {
    const places = item.boroughWide === true
      ? '<span class="tag">Borough-wide</span>'
      : (item.towns || []).map(town => `<span class="tag">${esc(town)}</span>`).join('');
    const itemPath = `/items/${stableItemKey(item.id)}`;
    const category = item.documentCategory || 'Council document';
    return `<article class="item"><div class="item-meta"><span class="source-pill official">Official record</span><div class="item-source">Ealing Council</div><div>${esc(fmtDate(item.publishedAt))}</div></div><div><button class="document-category" type="button" data-watch-category="${esc(category)}" title="Show only ${esc(category)} documents">${esc(category)}</button><h3><a href="${esc(itemPath)}">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}<div class="item-actions"><a href="${esc(itemPath)}">Add context →</a><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open council document ↗</a></div><div class="tags">${places}${(item.topics || []).map(topic => `<span class="tag">${esc(topic)}</span>`).join('')}</div>${item.metadataEnriched ? '<div class="document-note">Description recovered from the linked Ealing Council download page.</div>' : ''}</div></article>`;
  }).join('');
  bindCategoryButtons(timeline);
}

async function load() {
  status.textContent = 'Loading council document feeds…';
  try {
    const response = await fetch('/.netlify/functions/document-watch', { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    populateCategories(state.data.items || []);
    renderHealth();
    const responding = state.data?.diagnostics?.respondingFeeds ?? 0;
    const enabled = state.data?.diagnostics?.enabledFeeds ?? 0;
    status.textContent = `Updated ${new Intl.DateTimeFormat('en-GB', { hour:'2-digit', minute:'2-digit' }).format(new Date(state.data.generatedAt))} · ${responding}/${enabled} document feeds responding`;
    render();
  } catch {
    status.textContent = 'Document Watch is temporarily unavailable.';
    timeline.innerHTML = '<div class="empty">The council document feeds could not be loaded just now.</div>';
  }
}

$('#watchTown').addEventListener('change', event => { state.filters.town = event.target.value; render(); });
$('#watchTopic').addEventListener('change', event => { state.filters.topic = event.target.value; render(); });
$('#watchCategory').addEventListener('change', event => { state.filters.category = event.target.value; render(); });
$('#watchThisWeek').addEventListener('click', () => { state.filters.thisWeek = !state.filters.thisWeek; render(); });
$('#watchReset').addEventListener('click', () => {
  state.filters = { town:'All', topic:'All', category:'All', thisWeek:false };
  $('#watchTown').value = 'All';
  $('#watchTopic').value = 'All';
  $('#watchCategory').value = 'All';
  render();
});

load();
