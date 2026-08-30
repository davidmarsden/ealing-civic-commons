const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const labels = { place: 'Places', organisation: 'Organisations', person: 'People' };
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
  return `<article class="entity-card"><a class="entity-card-main" href="/${esc(entity.route)}"><h3>${esc(entity.name)}</h3><p>${esc(description)}</p></a><div class="entity-card-footer"><div class="entity-card-meta">${providers}</div>${source}</div></article>`;
}

function render() {
  const query = $('#entitySearch').value.trim().toLowerCase();
  const visible = allEntities.filter(entity => (activeType === 'all' || entity.type === activeType) && (!query || `${entity.name} ${(entity.aliases || []).join(' ')} ${entity.description || ''}`.toLowerCase().includes(query)));
  const root = $('#entityDirectory');
  const groups = ['place','organisation','person'].map(type => ({ type, items: visible.filter(entity => entity.type === type) })).filter(group => group.items.length);
  root.innerHTML = groups.map(group => `<section class="entity-directory-group"><div class="entity-directory-heading"><h2>${labels[group.type]}</h2><span>${group.items.length}</span></div><div class="entity-cards">${group.items.map(card).join('')}</div></section>`).join('');
  root.hidden = false;
  $('#exploreStatus').textContent = visible.length ? `${visible.length} civic ${visible.length === 1 ? 'entity' : 'entities'}` : 'No civic entities match this filter.';
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
