import { renderEvidenceGraphic } from './evidence-graphics.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));

function fmt(value, unit = '') {
  const number = Number(value);
  const text = Number.isFinite(number)
    ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(number)
    : String(value ?? '—');
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text;
}

function routePlace() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'places' ? String(parts[1] || '').replace(/\.html$/, '').toLowerCase() : null;
}

function selectedCollections(collections) {
  const pick = [];
  const imd = collections.find(item => item.indicatorId === 'I3091');
  const overcrowding = collections.find(item => item.indicatorId === 'I44458');
  const childPoverty = collections.find(item => item.indicatorId === 'I44674' && item.geographyLevel === 'Ward');
  for (const item of [imd, overcrowding, childPoverty]) if (item) pick.push(item);
  return pick;
}

function evidenceCard(collection) {
  const summary = collection.summary || {};
  const comparator = collection.comparator;
  const median = summary.kind === 'numeric' ? fmt(summary.median, collection.unit) : 'See distribution';
  const comparatorValue = comparator?.method === 'median' ? fmt(comparator.value, collection.unit) : null;
  const sourceUrl = `https://data.ealing.gov.uk/data-catalog-explorer/indicator/${encodeURIComponent(collection.indicatorId)}/`;
  const recordUrl = `/api/evidence/record?kind=collection&id=${encodeURIComponent(collection.id)}`;
  const revision = collection.storage?.revision ? ` · stored revision ${collection.storage.revision}` : '';

  return `<article class="entity-evidence-card">
    <div class="entity-evidence-head"><h3>${esc(collection.indicatorName)}</h3><span class="entity-evidence-period">${esc(collection.period)} · ${esc(collection.geographyLevel)}</span></div>
    <div class="entity-evidence-summary"><span>Southall median<strong>${esc(median)}</strong></span>${comparatorValue ? `<span>${esc(comparator.label || 'Ealing comparator')}<strong>${esc(comparatorValue)}</strong></span>` : ''}</div>
    ${renderEvidenceGraphic(collection)}
    <p class="entity-evidence-source"><a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Ealing Data source ↗</a> · <a href="${esc(recordUrl)}">Civic Commons record</a>${esc(revision)}</p>
  </article>`;
}

function syncHeroActions() {
  if (routePlace() !== 'southall') return false;
  const actions = document.querySelector('.entity-actions');
  if (!actions) return false;
  const labels = [
    ['#commonsAssertionsSection','Current civic facts ↓'],
    ['#localEvidenceSection','Local evidence ↓'],
    ['#relationshipsSection','Reviewed connections ↓'],
    ['#sourcesSection','Primary evidence ↓'],
    ['#currentSection','Current Commons ↓'],
    ['#reportingSection','Historical reporting ↓']
  ];
  actions.innerHTML = labels.map(([href,label]) => `<a href="${href}">${label}</a>`).join('');
  return true;
}

function watchHeroActions() {
  if (syncHeroActions()) return;
  const hero = $('#entityHero');
  if (!hero) return;
  const observer = new MutationObserver(() => {
    if (syncHeroActions()) observer.disconnect();
  });
  observer.observe(hero, { childList:true, subtree:true });
}

async function fetchPlaceEvidence(place) {
  const response = await fetch(`/api/evidence/place?place=${encodeURIComponent(place)}`, {
    cache: 'no-store',
    headers: { accept: 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status !== 'ok') throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function fetchSouthallFallback() {
  const response = await fetch('/api/evidence/southall', {
    cache: 'no-store',
    headers: { accept: 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === 'error') throw new Error(payload.error || `HTTP ${response.status}`);
  return {
    status: 'ok',
    place: 'Southall',
    updatedAt: payload.generatedAt,
    collections: (payload.collections || []).filter(collection => collection.place === 'Southall'),
    storage: { persisted: false, fallback: true }
  };
}

async function loadPlaceEvidence() {
  const place = routePlace();
  if (place !== 'southall') return;
  const section = $('#localEvidenceSection');
  const root = $('#localEvidence');
  if (!section || !root) return;

  try {
    let payload;
    try {
      payload = await fetchPlaceEvidence(place);
    } catch (placeError) {
      console.warn('Place evidence endpoint unavailable; falling back to Southall evidence payload', placeError);
      payload = await fetchSouthallFallback();
    }

    const selected = selectedCollections(payload.collections || []);
    if (!selected.length) throw new Error('No graphical Southall evidence collections were returned');

    root.className = 'entity-evidence-grid';
    root.innerHTML = selected.map(evidenceCard).join('');
    section.hidden = false;

    const meta = $('#localEvidenceMeta');
    if (meta) {
      const updated = payload.updatedAt ? new Date(payload.updatedAt).toLocaleString('en-GB') : 'unknown';
      const source = payload.storage?.persisted
        ? 'Served from the persistent Civic Commons evidence store.'
        : payload.storage?.fallback
          ? 'Served from the normalized Southall evidence fallback.'
          : 'Served live while persistent storage was unavailable.';
      meta.textContent = `Evidence snapshot updated ${updated}. ${source}`;
    }
  } catch (error) {
    console.warn('Place evidence unavailable', error);
    root.innerHTML = `<p class="entity-empty">Local evidence is temporarily unavailable. ${esc(error?.message || '')}</p>`;
    const meta = $('#localEvidenceMeta');
    if (meta) meta.textContent = 'The rest of this civic page is unaffected.';
    section.hidden = false;
  }
}

watchHeroActions();
loadPlaceEvidence();
