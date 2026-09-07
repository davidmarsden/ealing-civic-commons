const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const labels = { place: 'Places', organisation: 'Organisations', person: 'People' };
const BROWSE_LIMIT = 18;
const SEARCH_LIMIT = 60;
let allEntities = [];
let searchReferences = [];
let activeType = 'all';
let referenceTimer = null;
let referenceRequest = 0;

function renderCounts(counts = {}) {
  $('#placeCount').textContent = counts.place || 0;
  $('#organisationCount').textContent = counts.organisation || 0;
  $('#personCount').textContent = counts.person || 0;
  $('#allCount').textContent = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function profileCard(entity) {
  const providers = (entity.providers || []).map(provider => `<span class="entity-provider-pill">${esc(provider.label || provider.id)}</span>`).join('');
  const source = entity.source?.url ? `<a class="entity-source-link" href="${esc(entity.source.url)}" target="_blank" rel="noopener noreferrer">${esc(entity.source.label || 'Website / source')} ↗</a>` : '';
  const description = entity.description || 'Description pending editorial review.';
  const role = entity.type === 'person' && entity.publicRole ? `<p class="entity-public-role">${esc(entity.publicRole)}</p>` : '';
  const institution = entity.type !== 'person' && (entity.institutionType || entity.town) ? `<p class="entity-public-role">${esc([entity.institutionType, entity.town, entity.urn ? `URN ${entity.urn}` : null].filter(Boolean).join(' · '))}</p>` : '';
  return `<article class="entity-card"><a class="entity-card-main" href="/${esc(entity.route)}"><h3>${esc(entity.name)}</h3>${role}${institution}<p>${esc(description)}</p></a><div class="entity-card-footer"><div class="entity-card-meta">${providers}</div>${source}</div></article>`;
}

function referenceCard(entity) {
  const evidence = (entity.evidence || []).map(item => `<a class="entity-source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || 'Public record')} ↗</a>`).join('');
  const count = Number(entity.referenceCount || 0);
  return `<article class="entity-card entity-reference-card"><div class="entity-card-main"><h3>${esc(entity.name)}</h3><p class="entity-public-role">Civic reference</p><p>This name appears in ${count} reviewed civic ${count === 1 ? 'record' : 'records'}. It does not have a standalone Civic Commons profile.</p></div><div class="entity-card-footer"><div class="entity-card-meta"><span class="entity-provider-pill">Reference, not profile</span></div><div>${evidence}</div></div></article>`;
}

function card(entity) { return entity.kind === 'reference' ? referenceCard(entity) : profileCard(entity); }

function searchableText(entity) {
  return `${entity.name} ${(entity.aliases || []).join(' ')} ${entity.publicRole || ''} ${entity.ward || ''} ${entity.party || ''} ${entity.town || ''} ${entity.institutionType || ''} ${entity.phase || ''} ${entity.establishmentType || ''} ${entity.postcode || ''} ${entity.urn || ''} ${entity.description || ''}`.toLowerCase();
}

function groupedMarkup(items) {
  const groups = ['place','organisation','person'].map(type => ({ type, items: items.filter(entity => entity.type === type) })).filter(group => group.items.length);
  return groups.map(group => `<section class="entity-directory-group"><div class="entity-directory-heading"><h2>${labels[group.type]}</h2><span>${group.items.length}</span></div><div class="entity-cards">${group.items.map(card).join('')}</div></section>`).join('');
}

function render() {
  const query = $('#entitySearch').value.trim().toLowerCase();
  const root = $('#entityDirectory');
  if (!query && activeType === 'all') {
    root.innerHTML = '';
    root.hidden = true;
    $('#exploreStatus').textContent = 'Search the civic graph, or choose Places, Organisations or People to browse.';
    return;
  }
  const profiles = allEntities.filter(entity => {
    if (activeType !== 'all' && entity.type !== activeType) return false;
    return !query || searchableText(entity).includes(query);
  });
  const references = query && (activeType === 'all' || activeType === 'person') ? searchReferences.filter(entity => searchableText(entity).includes(query)) : [];
  const matches = [...profiles, ...references];
  const limit = query ? SEARCH_LIMIT : BROWSE_LIMIT;
  const visible = matches.slice(0, limit);
  root.innerHTML = groupedMarkup(visible);
  root.hidden = false;
  if (!matches.length) {
    $('#exploreStatus').textContent = query.length < 3 ? 'Keep typing to search people referenced in reviewed civic material.' : 'No civic profiles or references match this search.';
    return;
  }
  if (matches.length > visible.length) {
    $('#exploreStatus').textContent = `Showing ${visible.length} of ${matches.length} matches. Search more specifically to narrow the list.`;
    return;
  }
  const referenceCount = references.length;
  $('#exploreStatus').textContent = referenceCount ? `${matches.length} matches, including ${referenceCount} ${referenceCount === 1 ? 'civic reference' : 'civic references'}` : `${matches.length} civic ${matches.length === 1 ? 'profile' : 'profiles'}`;
}

async function fetchReferences(query) {
  const q = query.trim();
  if (q.length < 3) { searchReferences = []; render(); return; }
  const requestId = ++referenceRequest;
  try {
    const response = await fetch(`/.netlify/functions/civic-entities?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestId !== referenceRequest) return;
    searchReferences = data.references || [];
    render();
  } catch (error) {
    if (requestId !== referenceRequest) return;
    searchReferences = [];
    console.error('Explore reference search failed', error);
    render();
  }
}

async function load() {
  try {
    const response = await fetch('/.netlify/functions/civic-entities', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    allEntities = data.entities || [];
    renderCounts(data.counts);
    render();
    if (data.quality?.missingDescriptionCount) console.warn(`Explore entity-description audit: ${data.quality.missingDescriptionCount} entities still need editorial descriptions.`, data.quality.missingDescriptions);
    if (data.quality?.peopleMissingPublicStandingCount) console.warn(`Explore public-people audit: ${data.quality.peopleMissingPublicStandingCount} registered people still need an explicit public-role description.`, data.quality.peopleMissingPublicStanding);
  } catch (error) {
    $('#exploreStatus').textContent = 'The civic entity directory is temporarily unavailable.';
    console.error('Explore load failed', error);
  }
}

$('#entitySearch').addEventListener('input', () => {
  const query = $('#entitySearch').value;
  searchReferences = [];
  render();
  clearTimeout(referenceTimer);
  referenceTimer = setTimeout(() => fetchReferences(query), 180);
});

document.querySelectorAll('.explore-tab').forEach(button => button.addEventListener('click', () => {
  activeType = button.dataset.type;
  document.querySelectorAll('.explore-tab').forEach(item => item.classList.toggle('active', item === button));
  render();
}));

load();
