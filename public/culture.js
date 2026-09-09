const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[c]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

const state = { data: null, kind: 'events', town: 'All', search: '' };

function sourceLocations(item) {
  const locations = Array.isArray(item.sourceLocations) ? item.sourceLocations : [];
  if (item.boroughWide && !locations.includes('Boroughwide')) locations.push('Boroughwide');
  if (item.crossBoundary && !locations.includes('Park Royal')) locations.push('Park Royal');
  return locations;
}

function collection() {
  if (!state.data) return [];
  if (state.kind === 'events') return (state.data.items || []).filter(item => item.contentLabel === 'Event');
  if (state.kind === 'news') return (state.data.items || []).filter(item => item.contentLabel !== 'Event');
  if (state.kind === 'venues') return state.data.references?.venues || [];
  return state.data.references?.creatives || [];
}

function filtered() {
  const q = state.search.trim().toLowerCase();
  return collection().filter(item => {
    const locations = sourceLocations(item);
    const townOk = state.town === 'All' || locations.includes(state.town) || (state.town === 'Boroughwide' && item.boroughWide) || (state.town === 'Park Royal' && item.crossBoundary);
    if (!townOk) return false;
    if (!q) return true;
    const haystack = [item.title, item.summary, item.description, ...(item.publisherCategories || []), ...(item.categories || []), ...(item.secondaryCategories || []), ...locations].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

function render() {
  const items = filtered();
  const labels = { events: ['Events', 'Ealing Culture events'], news: ['News', 'Ealing Culture news'], venues: ['Reference directory', 'Cultural venues'], creatives: ['Reference directory', 'Local creatives'] };
  $('#cultureEyebrow').textContent = labels[state.kind][0];
  $('#cultureTitle').textContent = labels[state.kind][1];
  $('#cultureCount').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;

  if (!items.length) {
    $('#cultureList').innerHTML = '<div class="empty">Nothing matches these filters.</div>';
    return;
  }

  $('#cultureList').innerHTML = items.map(item => {
    const locations = sourceLocations(item);
    const categories = state.kind === 'events' || state.kind === 'news' ? (item.publisherCategories || []) : (item.categories || []);
    const secondary = state.kind === 'venues' || state.kind === 'creatives' ? (item.secondaryCategories || []) : [];
    const description = item.summary || item.description || '';
    const meta = state.kind === 'events' || state.kind === 'news'
      ? `<span>${esc(fmtDate(item.publishedAt))}</span><span class="source-pill official">Official record</span>`
      : `<span class="source-pill official">Official reference</span>`;
    const policy = state.kind === 'creatives' ? '<div class="reference-note">Reference-only — not a civic person profile.</div>' : '';
    return `<article class="culture-card"><div class="culture-meta">${meta}</div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${description ? `<p>${esc(description)}</p>` : ''}${policy}<div class="tags">${locations.map(x => `<span class="tag">${esc(x)}</span>`).join('')}${categories.map(x => `<span class="tag">${esc(x)}</span>`).join('')}${secondary.slice(0, 4).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div><div class="culture-actions"><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a></div></article>`;
  }).join('');
}

async function load() {
  try {
    const response = await fetch('/.netlify/functions/ealing-culture-feed', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    const health = state.data.health?.[0];
    $('#cultureStatus').textContent = health?.ok
      ? `Live WordPress REST source · ${(state.data.items || []).length} news/event items · ${(state.data.references?.venues || []).length} venues · ${(state.data.references?.creatives || []).length} creatives`
      : `Source partially available${health?.error ? ` · ${health.error}` : ''}`;
    render();
  } catch (error) {
    $('#cultureStatus').textContent = `Ealing Culture source unavailable · ${error.message || error}`;
    $('#cultureList').innerHTML = '<div class="empty">The live source could not be loaded.</div>';
  }
}

$('#cultureKind').addEventListener('change', e => { state.kind = e.target.value; render(); });
$('#cultureTown').addEventListener('change', e => { state.town = e.target.value; render(); });
$('#cultureSearch').addEventListener('input', e => { state.search = e.target.value; render(); });
load();
