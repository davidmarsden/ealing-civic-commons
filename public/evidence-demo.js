import { renderEvidenceGraphic } from './evidence-graphics.js';

const statusEl = document.querySelector('#evidenceStatus');
const metaEl = document.querySelector('#evidenceMeta');
const gridEl = document.querySelector('#evidenceCollections');

// Not every valid evidence collection benefits from graphical treatment.
// IMD decile is less informative here than the continuous IMD score, while
// homelessness is a single borough-wide figure rather than a local comparison.
const CHART_EXCLUDED_INDICATORS = new Set(['I3089', 'I44455']);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

function fmt(value, unit = '') {
  const numeric = Number(value);
  const text = Number.isFinite(numeric) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(numeric) : String(value ?? '—');
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text;
}

function warningLabel(code) {
  return ({
    'flat-spatial-values': 'Flat spatial values',
    'narrow-spatial-range': 'Narrow spatial range',
    'measurement-method-unknown': 'Measurement method not exposed',
    'monitor-location-unknown': 'Monitor location/type not exposed',
    'borough-value-repeated-on-small-area-layer': 'Borough-only figure',
    'historic-boundary-mismatch': 'Historic boundary mismatch',
    'source-metadata-incomplete': 'Source metadata incomplete'
  })[code] || code;
}

function summaryHtml(collection) {
  const summary = collection.summary;
  if (!summary) return '';
  if (summary.kind === 'distribution') {
    return `<div class="evidence-summary-line"><strong>${esc(summary.count)} areas</strong><span>distribution available in the evidence record</span></div>`;
  }
  if (summary.count === 1) return `<div class="evidence-single-value"><span>Published value</span><strong>${esc(fmt(summary.median, collection.unit))}</strong></div>`;
  return `<div class="evidence-summary"><div><span>Areas</span><strong>${esc(summary.count)}</strong></div><div><span>Minimum</span><strong>${esc(fmt(summary.min, collection.unit))}</strong></div><div><span>Median</span><strong>${esc(fmt(summary.median, collection.unit))}</strong></div><div><span>Maximum</span><strong>${esc(fmt(summary.max, collection.unit))}</strong></div></div>`;
}

function card(collection) {
  const warnings = (collection.methodology?.warnings || []).map(warningLabel);
  const comparator = collection.comparator;
  const comparatorText = comparator?.method === 'median'
    ? `${comparator.label}: ${fmt(comparator.value, collection.unit)} · ${comparator.population} areas`
    : comparator?.method === 'distribution'
      ? `${comparator.label} · ${comparator.population} areas`
      : '';
  const graphic = CHART_EXCLUDED_INDICATORS.has(collection.indicatorId) ? '' : renderEvidenceGraphic(collection);

  return `<article class="evidence-card">
    <div class="evidence-card-head"><div><p class="eyebrow">${esc(collection.indicatorId)}</p><h2>${esc(collection.indicatorName)}</h2></div><span class="evidence-period">${esc(collection.period)}</span></div>
    <div class="evidence-meta"><span>${esc(collection.place)}</span><span>${esc(collection.geographyLevel)}</span>${collection.unit ? `<span>${esc(collection.unit)}</span>` : ''}</div>
    ${summaryHtml(collection)}
    ${graphic}
    ${comparatorText ? `<p class="evidence-comparator-note">${esc(comparatorText)}</p>` : ''}
    ${warnings.length ? `<div class="evidence-warning-list">${warnings.map(warning => `<span>${esc(warning)}</span>`).join('')}</div>` : ''}
    ${collection.methodology?.note ? `<details class="evidence-method"><summary>Method and scope</summary><p>${esc(collection.methodology.note)}</p></details>` : ''}
    <div class="evidence-provenance"><span>${esc(collection.provenance?.publisher || '')}</span><span>${esc(collection.provenance?.sourceSystem || '')}</span></div>
  </article>`;
}

async function load() {
  try {
    const response = await fetch('/api/evidence/southall', { headers: { accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || payload.status === 'error') throw new Error(payload.error || `HTTP ${response.status}`);
    const graphicalCount = payload.collections.filter(collection => !CHART_EXCLUDED_INDICATORS.has(collection.indicatorId)).length;
    statusEl.textContent = `${payload.collections.length} validated evidence collections`;
    metaEl.textContent = `${graphicalCount} graphical views · Generated ${new Date(payload.generatedAt).toLocaleString('en-GB')} · ${payload.objects.length} source-checkable observations`;
    gridEl.innerHTML = payload.collections.map(card).join('');
  } catch (error) {
    statusEl.textContent = 'Evidence preview failed';
    metaEl.textContent = String(error?.message || error);
    gridEl.innerHTML = `<div class="evidence-error">${esc(error?.message || error)}</div>`;
  }
}

load();
