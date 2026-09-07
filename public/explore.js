const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const labels = { place: 'Places', organisation: 'Organisations', person: 'People' };
const BROWSE_LIMIT = 18;
const SEARCH_LIMIT = 60;
let allEntities = [];
let activeType = 'all';

function renderCounts(counts = {}) {
  $('#placeCount').textContent = counts.place || 0;
  $('#organisationCount').textContent = counts.organisation || 0;
  $('#personCount').textContent = counts.person || 0;
  $('#allCount').textContent = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function card(entity) {
  const providers = (entity.providers || []).map(provider => `<span class="entity-provider-pill">${esc(provider.label || provider.id)}</span>`).join('');
  const source = entity.source?.url ? `<a class="entity-source-link" href="${esc(entity.source.url)}" target="_blank" rel="noopener noreferrer">${esc(entity.source.label || 'Website / source')} ↗</a>` : '';
  const description = entity.description || 'Description pending editorial review.';
  const role = entity.type === 'person' && entity.publicRole ? `<p class="entity-public-role">${esc(entity.publicRole)}</p>` : '';
  return `<article class="entity-card"><a class="entity-card-main" href="/${esc(entity.route)}"><h3>${esc(entity.name)}</h3>${role}<p>${esc(description)}</p></a><div class="entity-card-footer"><div class="entity-card-meta">${providers}</div>${source}</div></article>`;
}

function searchableText(entity) {
  return `${entity.name} ${(entity.aliases || []).join(' ')} ${entity.publicRole || ''} ${entity.ward || ''} ${entity.party || ''} ${entity.description || ''}`.toLowerCase();
}

function groupedMarkup(items) {
  const groups = ['place','organisation','person']
    .map(type => ({ type, items: items.filter(entity => entity.type === type) }))
    .filter(group => group.items.length);
  return groups.map(group => `<section class="entity-directory-group"><div class="entity-directory-heading"><h2>${labels[group.type]}</h2><span>${group.items.length}</span></div><div class="entity-cards">${group.items.map(card).join('')}</div></section>`).join('');
}

function render() {
  const query = $('#entitySearch').value.trim().toLowerCase();
  const root = $('#entityDirectory');

  if (!query && activeType === 'all') {
    root.innerHTML = '';
    root.hidden = true;
    $('#exploreStatus').textContent = 'Search the civic graph, or choose Places, Organisations or People to browse a manageable slice.';
    return;
  }

  const matches = allEntities.filter(entity => {
    if (activeType !== 'all' && entity.type !== activeType) return false;
    return !query || searchableText(entity).includes(query);
  });

  const limit = query ? SEARCH_LIMIT : BROWSE_LIMIT;
  const visible = matches.slice(0, limit);
  root.innerHTML = groupedMarkup(visible);
  root.hidden = false;

  if (!matches.length) {
    $('#exploreStatus').textContent = 'No civic entities match this search.';
    return;
  }

  if (matches.length > visible.length) {
    $('#exploreStatus').textContent = `Showing ${visible.length} of ${matches.length} matching civic entities. Search more specifically to narrow the list.`;
    return;
  }

  $('#exploreStatus').textContent = `${matches.length} civic ${matches.length === 1 ? 'entity' : 'entities'}`;
}

async function load() {
  try {
    const response = await fetch('/.netlify/functions/civic-entities', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    allEntities = data.entities || [];
    renderCounts(data.counts);
    render();
    if (data.quality?.missingDescriptionCount) {
      console.warn(`Explore entity-description audit: ${data.quality.missingDescriptionCount} entities still need editorial descriptions.`, data.quality.missingDescriptions);
    }
    if (data.quality?.peopleMissingPublicStandingCount) {
      console.warn(`Explore public-people audit: ${data.quality.peopleMissingPublicStandingCount} registered people still need an explicit public-role description.`, data.quality.peopleMissingPublicStanding);
    }
    if (data.quality?.suppressedResearchPeopleCount) {
      console.info(`Explore data minimisation: ${data.quality.suppressedResearchPeopleCount} research-only people were not promoted into the public directory.`);
    }
  } catch (error) {
    $('#exploreStatus').textContent = 'The civic entity directory is temporarily unavailable.';
    console.error('Explore load failed', error);
  }
}

$('#entitySearch').addEventListener('input', render);
document.querySelectorAll('.explore-tab').forEach(button => button.addEventListener('click', () => {
  activeType = button.dataset.type;
  document.querySelectorAll('.explore-tab').forEach(item => item.classList.toggle('active', item === button));
  render();
}));

load();
