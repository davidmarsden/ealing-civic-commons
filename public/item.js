const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const pillClass = type => type === 'Official record'
  ? 'official'
  : type === 'Journalism / publishing'
    ? 'journalism'
    : type === 'Independent civic data / analysis'
      ? 'analysis'
      : 'organisation';

const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
};

function itemKey(id) {
  const bytes = new TextEncoder().encode(String(id ?? ''));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function routeKey() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'items' ? parts.slice(1).join('/') : '';
}

function fillContributionFields(item, key) {
  const thread = `civic-item:${key}`;
  $('#threadId').textContent = thread;
  $('#contributionItemId').value = item.id;
  $('#contributionThreadId').value = thread;
  $('#contributionPermalink').value = window.location.href;
  $('#contributionItemTitle').value = item.title;
  $('#contributionOriginalUrl').value = item.url;
}

function renderItem(item, key) {
  document.title = `${item.title} — Civic Commons`;
  $('#itemStatus').hidden = true;
  const view = $('#itemView');
  view.hidden = false;
  view.innerHTML = `
    <div class="item-page-meta">
      <span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span>
      <span>${esc(item.source)}</span>
      <span>${esc(fmtDate(item.publishedAt))}</span>
    </div>
    <h1>${esc(item.title)}</h1>
    ${item.summary ? `<p class="item-page-summary">${esc(item.summary)}</p>` : ''}
    ${item.derived ? `<p class="provenance-note"><strong>Commons-derived extract:</strong> ${esc(item.derivedFrom || 'derived from the source material')}.</p>` : ''}
    <div class="tags">
      ${(item.towns || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
      ${(item.topics || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}
    </div>
    <div class="item-page-actions">
      <a class="primary-source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Read the original source ↗</a>
      <a href="#contribute">Add to this story ↓</a>
    </div>
    <p class="canonical-note">The original publisher remains the canonical source. This Commons URL exists so local context, evidence, corrections and discussion can attach to a stable civic object.</p>
  `;

  fillContributionFields(item, key);
  $('#contribute').hidden = false;
  $('#discussion').hidden = false;
}

function renderMissing(key) {
  const status = $('#itemStatus');
  status.innerHTML = `
    <h1>This item is not in the current live window.</h1>
    <p>The permalink and thread identity are stable, but the prototype does not yet persist every ingested item in a civic data store. Older items can therefore fall out of the current feed window.</p>
    <p><strong>Item key:</strong> <code>${esc(key)}</code></p>
    <p><a href="/">Return to the current civic timeline →</a></p>
  `;
}

async function load() {
  const key = routeKey();
  if (!key) {
    renderMissing('missing');
    return;
  }

  try {
    const response = await fetch('/.netlify/functions/feed', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const item = (data.items || []).find(candidate => itemKey(candidate.id) === key);
    if (!item) {
      renderMissing(key);
      return;
    }
    renderItem(item, key);
  } catch (error) {
    const status = $('#itemStatus');
    status.innerHTML = `<h1>Item temporarily unavailable.</h1><p>The live civic feed could not be loaded. The original item permalink has not changed.</p><p><a href="/">Return to the timeline →</a></p>`;
    console.error('Item load failed', error);
  }
}

load();
