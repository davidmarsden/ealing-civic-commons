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

async function loadPlaceEvidence() {
  const place = routePlace();
  if (place !== 'southall') return;
  const section = $('#localEvidenceSection');
  const root = $('#localEvidence');
  if (!section || !root) return;

  try {
    const response = await fetch(`/api/evidence/place?place=${encodeURIComponent(place)}`, { headers: { accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || payload.status !== 'ok') throw new Error(payload.error || `HTTP ${response.status}`);
    const selected = selectedCollections(payload.collections || []);
    if (!selected.length) return;

    root.className = 'entity-evidence-grid';
    root.innerHTML = selected.map(evidenceCard).join('');
    section.hidden = false;

    const meta = $('#localEvidenceMeta');
    if (meta) {
      const updated = payload.updatedAt ? new Date(payload.updatedAt).toLocaleString('en-GB') : 'unknown';
      meta.textContent = `Evidence snapshot updated ${updated}. ${payload.storage?.persisted ? 'Served from the persistent Civic Commons evidence store.' : 'Served live while persistent storage was unavailable.'}`;
    }
  } catch (error) {
    console.warn('Place evidence unavailable', error);
  }
}

loadPlaceEvidence();
