function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, unit = '') {
  const n = number(value);
  const text = n === null ? String(value ?? '—') : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n);
  return unit === '%' ? `${text}%` : unit ? `${text} ${unit}` : text;
}

function warningCodes(collection) {
  return new Set((collection.methodology?.warnings || collection.warnings || []).map(item => typeof item === 'string' ? item : item?.code).filter(Boolean));
}

export function comparatorBars({ southallLabel = 'Southall', southallValue, comparatorLabel = 'Ealing', comparatorValue, unit = '' }) {
  const a = number(southallValue);
  const b = number(comparatorValue);
  if (a === null || b === null) return '';
  const max = Math.max(Math.abs(a), Math.abs(b), 0.000001);
  const widthA = Math.max(1, Math.round((Math.abs(a) / max) * 100));
  const widthB = Math.max(1, Math.round((Math.abs(b) / max) * 100));
  return `<figure class="evidence-graphic evidence-comparator" aria-label="${esc(southallLabel)} compared with ${esc(comparatorLabel)}">
    <div class="evidence-bar-row"><span>${esc(southallLabel)}</span><div class="evidence-bar-track"><i style="width:${widthA}%"></i></div><strong>${esc(fmt(a, unit))}</strong></div>
    <div class="evidence-bar-row"><span>${esc(comparatorLabel)}</span><div class="evidence-bar-track"><i style="width:${widthB}%"></i></div><strong>${esc(fmt(b, unit))}</strong></div>
  </figure>`;
}

export function rangePosition({ min, median, max, comparatorMedian, unit = '', label = 'Southall median within Ealing range' }) {
  const lo = number(min), mid = number(median), hi = number(max), compare = number(comparatorMedian);
  if ([lo, mid, hi].some(value => value === null) || hi <= lo) return '';
  const pct = value => Math.max(0, Math.min(100, ((value - lo) / (hi - lo)) * 100));
  return `<figure class="evidence-graphic evidence-range" aria-label="${esc(label)}">
    <div class="evidence-range-scale"><i class="evidence-range-southall" style="left:${pct(mid).toFixed(1)}%"><span>Southall<br>${esc(fmt(mid, unit))}</span></i>${compare === null ? '' : `<i class="evidence-range-comparator" style="left:${pct(compare).toFixed(1)}%"><span>Ealing<br>${esc(fmt(compare, unit))}</span></i>`}</div>
    <div class="evidence-range-labels"><span>${esc(fmt(lo, unit))}</span><span>${esc(fmt(hi, unit))}</span></div>
  </figure>`;
}

export function distributionStrip({ values = [], label = 'Distribution' }) {
  const rows = values.map(item => ({ value: item.value, count: Number(item.count) || 0 })).filter(item => item.count > 0);
  const total = rows.reduce((sum, item) => sum + item.count, 0);
  if (!total) return '';
  return `<figure class="evidence-graphic evidence-distribution" aria-label="${esc(label)}"><div class="evidence-distribution-strip">${rows.map(item => `<span style="flex:${item.count}" title="${esc(item.value)}: ${item.count}"><b>${esc(item.value)}</b><small>${item.count}</small></span>`).join('')}</div></figure>`;
}

export function renderEvidenceGraphic(collection) {
  const warnings = warningCodes(collection);
  if (warnings.has('borough-value-repeated-on-small-area-layer')) return '';

  if (collection.summary?.kind === 'distribution') {
    return distributionStrip({ values: collection.summary.values, label: `${collection.place || 'Area'} distribution` });
  }

  const summary = collection.summary;
  const comparator = collection.comparator;
  if (!summary || !comparator) return '';

  const unit = collection.unit || '';
  const bars = comparatorBars({
    southallLabel: collection.place || 'Southall',
    southallValue: summary.median,
    comparatorLabel: comparator.label || 'Comparator',
    comparatorValue: comparator.value,
    unit
  });

  if (warnings.has('flat-spatial-values')) return bars;

  const range = rangePosition({
    min: comparator.min ?? summary.min,
    median: summary.median,
    max: comparator.max ?? summary.max,
    comparatorMedian: comparator.value,
    unit,
    label: `${collection.place || 'Southall'} median within ${comparator.label || 'comparator'} range`
  });

  return `${bars}${range}`;
}
