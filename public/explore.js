const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const labels = { place: 'Places', organisation: 'Organisations', person: 'People' };
const BROWSE_LIMIT = 18;
const SEARCH_LIMIT = 60;
let allEntities = [];
let searchReferences = [];
let profileElectionRecords = new Map();
let activeType = 'all';
let referenceTimer = null;
let referenceRequest = 0;

function renderCounts(counts = {}) {
  $('#placeCount').textContent = counts.place || 0;
  $('#organisationCount').textContent = counts.organisation || 0;
  $('#personCount').textContent = counts.person || 0;
  $('#allCount').textContent = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
}

function electionRecordMarkup(records = []) {
  if (!records.length) return '';
  const items = records.map(item => {
    const date = item.electionDate ? new Date(`${item.electionDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    const votes = Number.isFinite(Number(item.votes)) ? ` · ${Number(item.votes).toLocaleString('en-GB')} votes` : '';
    const result = item.elected ? ' · elected' : '';
    const label = `<strong>${esc(item.ward)} ward</strong> · ${esc(item.party)} · ${esc(date)}${votes}${result}`;
    return `<li>${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label}</li>`;
  }).join('');
  return `<div class="entity-election-record"><p class="entity-public-role">Official election record</p><ul>${items}</ul></div>`;
}

function profileCard(entity) {
  const providers = (entity.providers || []).map(provider => `<span class="entity-provider-pill">${esc(provider.label || provider.id)}</span>`).join('');
  const source = entity.source?.url ? `<a class="entity-source-link" href="${esc(entity.source.url)}" target="_blank" rel="noopener noreferrer">${esc(entity.source.label || 'Website / source')} ↗</a>` : '';
  const description = entity.description || 'Description pending editorial review.';
  const role = entity.type === 'person' && entity.publicRole ? `<p class="entity-public-role">${esc(entity.publicRole)}</p>` : '';
  const institution = entity.type !== 'person' && (entity.institutionType || entity.town) ? `<p class="entity-public-role">${esc([entity.institutionType, entity.town, entity.urn ? `URN ${entity.urn}` : null].filter(Boolean).join(' · '))}</p>` : '';
  const electionRecord = entity.type === 'person' ? electionRecordMarkup(entity.electionRecords || []) : '';
  return `<article class="entity-card"><a class="entity-card-main" href="/${esc(entity.route)}"><h3>${esc(entity.name)}</h3>${role}${institution}<p>${esc(description)}</p></a>${electionRecord}<div class="entity-card-footer"><div class="entity-card-meta">${providers}</div>${source}</div></article>`;
}

function electionReferenceCard(entity) {
  const roles = (entity.candidacies || []).map(item => {
    const date = item.electionDate ? new Date(`${item.electionDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
    const votes = Number.isFinite(Number(item.votes)) ? ` · ${Number(item.votes).toLocaleString('en-GB')} votes` : '';
    const result = item.elected ? ' · elected' : '';
    return `<li><strong>${esc(item.ward)} ward</strong> · ${esc(item.party)} · ${esc(date)}${votes}${result}</li>`;
  }).join('');
  const evidence = (entity.evidence || []).filter(item => item?.url).map(item => `<a class="entity-source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || 'Public record')} ↗</a>`).join('');
  const reviewed = Number(entity.reviewedReferenceCount || 0);
  const context = reviewed
    ? `This person also appears in ${reviewed} reviewed civic ${reviewed === 1 ? 'record' : 'records'}. Election candidacies are kept as dated public-record events rather than a separate person.`
    : 'This is a dated civic role from Ealing Council election results, not a standalone Civic Commons profile.';
  return `<article class="entity-card entity-reference-card"><div class="entity-card-main"><h3>${esc(entity.name)}</h3><p class="entity-public-role">Civic reference with election record</p><p>${esc(context)}</p>${roles ? `<ul>${roles}</ul>` : ''}</div><div class="entity-card-footer"><div class="entity-card-meta"><span class="entity-provider-pill">Reference, not profile</span></div><div>${evidence}</div></div></article>`;
}

function referenceCard(entity) {
  if (entity.referenceKind === 'election-candidate') return electionReferenceCard(entity);
  const evidence = (entity.evidence || []).filter(item => item?.url).map(item => `<a class="entity-source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title || 'Public record')} ↗</a>`).join('');
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
  }).map(entity => {
    const electionRecords = profileElectionRecords.get(entity.route) || [];
    return electionRecords.length ? { ...entity, electionRecords } : entity;
  });
  const references = query && (activeType === 'all' || activeType === 'person') ? searchReferences.filter(entity => searchableText(entity).includes(query)) : [];
  const matches = [...profiles, ...references];
  const limit = query ? SEARCH_LIMIT : BROWSE_LIMIT;
  const visible = matches.slice(0, limit);
  root.innerHTML = groupedMarkup(visible);
  root.hidden = false;
  if (!matches.length) {
    $('#exploreStatus').textContent = query.length < 3 ? 'Keep typing to search people referenced in reviewed civic material and official election records.' : 'No civic profiles or references match this search.';
    return;
  }
  if (matches.length > visible.length) {
    $('#exploreStatus').textContent = `Showing ${visible.length} of ${matches.length} matches. Search more specifically to narrow the list.`;
    return;
  }
  const referenceCount = references.length;
  $('#exploreStatus').textContent = referenceCount ? `${matches.length} matches, including ${referenceCount} ${referenceCount === 1 ? 'civic reference' : 'civic references'}` : `${matches.length} civic ${matches.length === 1 ? 'profile' : 'profiles'}`;
}

function refNormal(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function fullReferenceSignature(value) {
  const parts = refNormal(value).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[parts.length - 1]}:${parts[0][0]}`;
}

function electionReferenceSignature(entity) {
  const sourceName = entity.candidacies?.[0]?.candidateNameSource || entity.name;
  const parts = refNormal(sourceName).split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts[parts.length - 1].length !== 1) return null;
  return `${parts[parts.length - 2]}:${parts[parts.length - 1]}`;
}

function mergeReferences(...sets) {
  const entities = sets.flat().filter(entity => entity?.name);
  const archive = entities.filter(entity => entity.referenceKind !== 'election-candidate');
  const elections = entities.filter(entity => entity.referenceKind === 'election-candidate');
  const usedArchive = new Set();
  const merged = [];

  for (const election of elections) {
    const signature = electionReferenceSignature(election);
    const candidates = signature ? archive.filter(item => fullReferenceSignature(item.name) === signature) : [];
    if (candidates.length === 1) {
      const civic = candidates[0];
      usedArchive.add(civic);
      merged.push({
        ...election,
        name: civic.name,
        description: civic.description || election.description,
        reviewedReferenceCount: Number(civic.referenceCount || 0),
        referenceCount: Number(civic.referenceCount || 0) + Number(election.referenceCount || 0),
        evidence: [...(civic.evidence || []), ...(election.evidence || [])]
      });
    } else {
      merged.push(election);
    }
  }

  for (const civic of archive) {
    if (!usedArchive.has(civic)) merged.push(civic);
  }

  const byKey = new Map();
  for (const entity of merged) {
    const key = `${entity.referenceKind || 'civic'}:${refNormal(entity.name)}`;
    if (!byKey.has(key)) byKey.set(key, entity);
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchReferences(query) {
  const q = query.trim();
  if (q.length < 3) { searchReferences = []; profileElectionRecords = new Map(); render(); return; }
  const requestId = ++referenceRequest;
  try {
    const [archiveResult, electionResult] = await Promise.allSettled([
      fetch(`/.netlify/functions/civic-entities?q=${encodeURIComponent(q)}`, { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error(`archive HTTP ${response.status}`);
        return response.json();
      }),
      fetch(`/.netlify/functions/ealing-election-candidate-search?q=${encodeURIComponent(q)}`, { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error(`election HTTP ${response.status}`);
        return response.json();
      })
    ]);
    if (requestId !== referenceRequest) return;
    const archiveReferences = archiveResult.status === 'fulfilled' ? (archiveResult.value.references || []) : [];
    const electionReferences = electionResult.status === 'fulfilled' ? (electionResult.value.references || []) : [];
    const electionProfiles = electionResult.status === 'fulfilled' ? (electionResult.value.profileElectionRecords || []) : [];
    searchReferences = mergeReferences(archiveReferences, electionReferences);
    profileElectionRecords = new Map(electionProfiles.map(item => [item.route, item.candidacies || []]));
    render();
  } catch (error) {
    if (requestId !== referenceRequest) return;
    searchReferences = [];
    profileElectionRecords = new Map();
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
  profileElectionRecords = new Map();
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
