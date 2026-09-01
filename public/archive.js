const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const API = '/.netlify/functions/civic-archive';
let nextOffset = 0;
let loading = false;
let activeFilters = {};

function fmtDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric' }).format(date);
}

function recordCard(record) {
  const item = record.item || {};
  const href = `/items/${encodeURIComponent(record.key)}`;
  return `<article class="archive-card">
    <div class="archive-card-meta"><span>${esc(item.source || 'Unknown source')}</span><span>${esc(fmtDate(item.publishedAt))}</span></div>
    <h2><a href="${href}">${esc(item.title || 'Untitled')}</a></h2>
    ${item.summary ? `<p>${esc(item.summary)}</p>` : ''}
    <div class="archive-tags">${(item.towns || []).map(value => `<span>${esc(value)}</span>`).join('')}${(item.topics || []).map(value => `<span>${esc(value)}</span>`).join('')}</div>
    <div class="archive-links"><a href="${href}">Open Civic Commons item →</a>${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Original source ↗</a>` : ''}</div>
  </article>`;
}

function currentFilters() {
  return {
    q: $('#archiveSearch').value.trim(),
    town: $('#archiveTown').value,
    topic: $('#archiveTopic').value,
    source: $('#archiveSource').value
  };
}

function addSourceOptions(sources = []) {
  const select = $('#archiveSource');
  const selected = select.value;
  const known = new Set([...select.options].map(option => option.value));
  sources.forEach(source => {
    if (!source?.id || known.has(source.id)) return;
    const option = document.createElement('option');
    option.value = source.id;
    option.textContent = source.name || source.id;
    select.append(option);
    known.add(source.id);
  });
  select.value = selected;
}

async function load({ append = false } = {}) {
  if (loading) return;
  loading = true;
  $('#archiveMore').disabled = true;
  if (!append) {
    activeFilters = currentFilters();
    nextOffset = 0;
    $('#archiveList').innerHTML = '';
    $('#archiveStatus').textContent = 'Searching the Civic Archive…';
  }

  try {
    const url = new URL(API, location.origin);
    url.searchParams.set('limit', '40');
    url.searchParams.set('offset', String(nextOffset));
    Object.entries(activeFilters).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); });
    const response = await fetch(url, { cache:'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    addSourceOptions(data.facets?.sources || []);
    const records = data.records || [];
    if (!append && !records.length) {
      $('#archiveList').innerHTML = '<div class="archive-empty"><strong>No archived items match those filters.</strong><span>Try a broader place, topic or search term.</span></div>';
    } else if (records.length) {
      $('#archiveList').insertAdjacentHTML('beforeend', records.map(recordCard).join(''));
    }

    nextOffset = data.nextOffset ?? nextOffset + records.length;
    $('#archiveMore').hidden = !data.hasMore;
    $('#archiveStatus').textContent = `${data.archiveSize || 0} civic items stored${Object.values(activeFilters).some(Boolean) ? ` · ${$('#archiveList').querySelectorAll('.archive-card').length} shown for this search` : ''}.`;
  } catch (error) {
    $('#archiveStatus').textContent = error.message;
    if (!append) $('#archiveList').innerHTML = '<div class="archive-empty"><strong>The Civic Archive is temporarily unavailable.</strong><span>The live timeline and permanent item URLs are unaffected.</span></div>';
  } finally {
    loading = false;
    $('#archiveMore').disabled = false;
  }
}

$('#archiveApply').addEventListener('click', () => load());
$('#archiveSearch').addEventListener('keydown', event => { if (event.key === 'Enter') load(); });
$('#archiveMore').addEventListener('click', () => load({ append:true }));
load();
