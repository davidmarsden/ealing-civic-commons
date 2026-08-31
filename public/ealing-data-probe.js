const endpoint = '/api/ealing-data-probe';
const statusEl = document.querySelector('#probeStatus');
const metaEl = document.querySelector('#probeMeta');
const groupsEl = document.querySelector('#probeGroups');
const geoEl = document.querySelector('#geoDiagnostics');
const refreshEl = document.querySelector('#probeRefresh');
const scopeMapEl = document.querySelector('#scopeMap');

let currentMaps = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));

function valueText(value, unit) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  const raw = Number.isFinite(numeric)
    ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 3 }).format(numeric)
    : String(value);
  if (!unit) return raw;
  const normalized = String(unit).trim();
  if (!normalized) return raw;
  if (/^%|percent/i.test(normalized)) return `${raw}%`;
  return `${raw} ${normalized}`;
}

function differenceText(southall, ealing, unit) {
  const diff = Number(southall) - Number(ealing);
  if (!Number.isFinite(diff)) return '';
  const sign = diff > 0 ? '+' : '';
  return `${sign}${valueText(diff, unit)}`;
}

function renderComparator(instance) {
  const comparator = instance.comparator;
  if (!comparator?.values) return '';
  if (comparator.kind === 'distribution') {
    return `<div class="probe-comparator"><div><span>${esc(comparator.label)}</span><div class="probe-comparator-chips">${comparator.values.map(item => `<span class="probe-chip">Decile ${esc(item.value)}: ${esc(item.count)}</span>`).join('')}</div></div></div>`;
  }
  const values = comparator.values;
  if (!values) return '';
  const southallMedian = instance.summary?.values?.median;
  return `<div class="probe-comparator">
    <div><span>${esc(comparator.label)}</span><strong>${esc(valueText(values.median, instance.unit))}</strong></div>
    ${Number.isFinite(Number(southallMedian)) ? `<div><span>Southall median difference</span><strong>${esc(differenceText(southallMedian, values.median, instance.unit))}</strong></div>` : ''}
    <div><span>Ealing range</span><strong>${esc(valueText(values.min, instance.unit))}–${esc(valueText(values.max, instance.unit))}</strong></div>
  </div>`;
}

function renderSummary(instance) {
  const summary = instance.summary;
  if (!summary?.values) return '';
  if (summary.kind === 'distribution') {
    return `<div class="probe-summary probe-summary-distribution"><strong>Distribution across ${esc(instance.observations?.length || 0)} Southall LSOAs</strong><div>${summary.values.map(item => `<span class="probe-chip">Decile ${esc(item.value)}: ${esc(item.count)}</span>`).join('')}</div></div>${renderComparator(instance)}`;
  }
  const values = summary.values;
  if (!values) return '';
  if (values.count < 4) return renderComparator(instance);
  return `<div class="probe-summary"><div><span>Areas</span><strong>${esc(values.count)}</strong></div><div><span>Minimum</span><strong>${esc(valueText(values.min, instance.unit))}</strong></div><div><span>Median</span><strong>${esc(valueText(values.median, instance.unit))}</strong></div><div><span>Maximum</span><strong>${esc(valueText(values.max, instance.unit))}</strong></div></div>${renderComparator(instance)}`;
}

function areaDetail(obs) {
  const area = obs.area || {};
  const bits = [];
  if (area.code) bits.push(area.code);
  if (area.msoaName) bits.push(area.msoaName);
  return bits.length ? `<small>${esc(bits.join(' · '))}</small>` : '';
}

function observationHtml(obs, unit) {
  return `<div class="probe-value"><span><span class="probe-place">${esc(obs.place)}</span>${areaDetail(obs)}</span><strong>${esc(valueText(obs.value, unit))}</strong></div>`;
}

function renderObservations(instance) {
  const observations = instance.observations || [];
  if (!observations.length) return '<div class="probe-empty">No Southall observation matched safely for this instance.</div>';
  if (observations.length <= 8) {
    return `<div class="probe-values">${observations.map(obs => observationHtml(obs, instance.unit)).join('')}</div>`;
  }
  const sample = observations.slice(0, 6);
  return `<details class="probe-observation-details"><summary>Show all ${esc(observations.length)} published area values</summary><div class="probe-values">${sample.map(obs => observationHtml(obs, instance.unit)).join('')}<p class="probe-sample-note">Showing the first 6 in the collapsed preview. Open the full list below.</p>${observations.slice(6).map(obs => `<div class="probe-value probe-value-extra"><span><span class="probe-place">${esc(obs.place)}</span>${areaDetail(obs)}</span><strong>${esc(valueText(obs.value, instance.unit))}</strong></div>`).join('')}</div></details>`;
}

function geometryCoordinates(geometry) {
  return (geometry?.rings || []).flat();
}

function extentFor(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const feature of features || []) {
    for (const point of geometryCoordinates(feature.geometry)) {
      if (!Array.isArray(point) || point.length < 2) continue;
      const [x, y] = point;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function projection(extent, width, height, pad = 12) {
  const spanX = Math.max(0.000001, extent.maxX - extent.minX);
  const spanY = Math.max(0.000001, extent.maxY - extent.minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const drawnWidth = spanX * scale;
  const drawnHeight = spanY * scale;
  const offsetX = (width - drawnWidth) / 2;
  const offsetY = (height - drawnHeight) / 2;
  return ([x, y]) => [offsetX + (x - extent.minX) * scale, height - offsetY - (y - extent.minY) * scale];
}

function pathFor(feature, project) {
  return (feature.geometry?.rings || []).map(ring => ring.map((point, index) => {
    const [x, y] = project(point);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z').join('');
}

function featureCentre(feature, project) {
  const coords = geometryCoordinates(feature.geometry);
  if (!coords.length) return [0, 0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return project([(minX + maxX) / 2, (minY + maxY) / 2]);
}

function renderScopeMap(maps) {
  if (!scopeMapEl) return;
  const features = maps?.wards || [];
  const extent = extentFor(features);
  if (!extent || !features.length) {
    scopeMapEl.innerHTML = '<p class="probe-empty">Ward geometry unavailable.</p>';
    return;
  }
  const width = 720, height = 460;
  const project = projection(extent, width, height, 18);
  const paths = features.map(feature => {
    const cls = feature.scope === 'southall-town' ? 'map-town' : feature.scope === 'constituency-context' ? 'map-constituency' : 'map-ealing';
    return `<path class="${cls}" d="${pathFor(feature, project)}"><title>${esc(feature.name)}</title></path>`;
  }).join('');
  const labels = features.filter(feature => feature.scope !== 'ealing-context').map(feature => {
    const [x, y] = featureCentre(feature, project);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="map-label ${feature.scope === 'constituency-context' ? 'map-label-context' : ''}">${esc(feature.name)}</text>`;
  }).join('');
  scopeMapEl.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Ealing wards, highlighting the six Southall town wards and two additional Ealing Southall constituency wards">${paths}${labels}</svg>`;
}

function valueLookup(instance) {
  return new Map((instance.observations || []).filter(obs => obs.area?.code).map(obs => [obs.area.code, obs]));
}

function mapOpacity(value, instance, categorical) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.08;
  if (categorical) {
    const decile = Math.max(1, Math.min(10, numeric));
    return 0.88 - ((decile - 1) / 9) * 0.65;
  }
  const ealing = instance.comparator?.values;
  const min = Number(ealing?.min);
  const max = Number(ealing?.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0.55;
  const position = Math.max(0, Math.min(1, (numeric - min) / (max - min)));
  return 0.14 + position * 0.72;
}

function renderDataMap(instance, indicator) {
  if (!currentMaps) return '';
  const geography = instance.geography?.name;
  const features = geography === 'LSOA 2021'
    ? currentMaps.lsoas || []
    : geography === 'Ward'
      ? currentMaps.wards || []
      : [];
  if (!features.length) return '';
  const extent = extentFor(features);
  if (!extent) return '';
  const width = 620, height = 390;
  const project = projection(extent, width, height, 14);
  const lookup = valueLookup(instance);
  const categorical = indicator.dataType === 'decile' || instance.summary?.kind === 'distribution';
  const paths = features.map(feature => {
    const obs = lookup.get(feature.code);
    const isContext = geography === 'Ward' && !obs;
    const opacity = obs ? mapOpacity(obs.value, instance, categorical) : (isContext ? 0.05 : 0.04);
    const title = obs
      ? `${obs.place}: ${valueText(obs.value, instance.unit)}`
      : feature.name;
    return `<path class="map-data-area${obs ? ' has-value' : ''}" d="${pathFor(feature, project)}" style="fill-opacity:${opacity.toFixed(3)}"><title>${esc(title)}</title></path>`;
  }).join('');
  const labels = geography === 'Ward'
    ? features.filter(feature => lookup.has(feature.code)).map(feature => {
        const [x, y] = featureCentre(feature, project);
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="map-label">${esc(feature.name)}</text>`;
      }).join('')
    : '';
  const scaleNote = categorical ? 'Darker = more deprived decile' : 'Shading uses the Ealing-wide range';
  return `<div class="probe-data-map"><div class="probe-map-caption"><strong>Where is this?</strong><span>${esc(scaleNote)}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Map of ${esc(indicator.name)} across ${esc(geography)} areas in Southall">${paths}${labels}</svg></div>`;
}

function renderVariation(instance, group) {
  if (group.id !== 'air-quality' || instance.summary?.kind !== 'numeric') return '';
  const southall = instance.summary?.values;
  const ealing = instance.comparator?.values;
  if (!southall || southall.count < 2) return '';
  const southallSpan = Number(southall.max) - Number(southall.min);
  const ealingSpan = ealing ? Number(ealing.max) - Number(ealing.min) : NaN;
  if (southallSpan === 0) {
    return `<div class="probe-method-warning"><strong>Flat published value:</strong> all ${esc(southall.count)} Southall LSOAs carry exactly ${esc(valueText(southall.min, instance.unit))}. This should not be read as evidence that local exposure is genuinely identical everywhere.</div>`;
  }
  if (Number.isFinite(ealingSpan) && ealingSpan > 0) {
    const share = Math.round((southallSpan / ealingSpan) * 100);
    return `<div class="probe-method-warning"><strong>Narrow spatial spread:</strong> Southall runs from ${esc(valueText(southall.min, instance.unit))} to ${esc(valueText(southall.max, instance.unit))}, about ${esc(share)}% of the Ealing-wide LSOA range. The map is scaled to Ealing, not stretched to make this small difference look dramatic.</div>`;
  }
  return '';
}

function renderInstance(instance, indicator, group) {
  if (instance.error) return `<div class="probe-instance"><div class="probe-error">${esc(instance.error)}</div></div>`;
  return `<div class="probe-instance">
    <div class="probe-instance-head"><strong>${esc(instance.date || 'Latest')}</strong><span>${esc(instance.geography?.name || '')}</span></div>
    ${renderDataMap(instance, indicator)}
    ${renderSummary(instance)}
    ${renderVariation(instance, group)}
    ${renderObservations(instance)}
    <div class="probe-service">Field: ${esc(instance.fieldId || '—')} · published Southall rows: ${esc(instance.matchedRows ?? 0)}${instance.serviceUrl ? ` · ${esc(instance.serviceUrl)}` : ''}</div>
  </div>`;
}

function renderIndicator(indicator, group) {
  return `<article class="probe-card">
    <div><p class="eyebrow">${esc(indicator.id)}</p><h3>${esc(indicator.name)}</h3></div>
    <div class="probe-card-meta"><span class="probe-chip">${esc(indicator.geography?.name || 'Unknown geography')}</span>${indicator.dataType ? `<span class="probe-chip">${esc(indicator.dataType)}</span>` : ''}</div>
    ${(indicator.instances || []).map(instance => renderInstance(instance, indicator, group)).join('') || '<div class="probe-empty">No matching instances selected.</div>'}
  </article>`;
}

function renderGroup(group) {
  const body = group.error
    ? `<div class="probe-error">${esc(group.error)}</div>`
    : group.warning
      ? `<div class="probe-warning">${esc(group.warning)}</div>`
      : `<div class="probe-grid">${(group.indicators || []).map(indicator => renderIndicator(indicator, group)).join('')}</div>`;
  return `<section class="probe-group">
    <div class="probe-group-header"><div><p class="eyebrow">Ealing Data probe</p><h2>${esc(group.label)}</h2></div><span class="probe-candidate-count">${esc(group.candidates ?? 0)} curated indicators</span></div>
    ${group.note ? `<p class="probe-group-note">${esc(group.note)}</p>` : ''}
    ${body}
  </section>`;
}

function renderGeographies(rows) {
  geoEl.innerHTML = (rows || []).map(row => `<div class="geo-row"><strong>${esc(row.name)}</strong><span>${esc(row.matchedFeatures)} Southall features</span><span>${row.error ? esc(row.error) : 'matched from Ealing geography service'}</span></div>`).join('') || '<p>No geography diagnostics returned.</p>';
}

async function load({ fresh = false } = {}) {
  statusEl.textContent = 'Loading Ealing Data…';
  metaEl.textContent = 'Following curated catalogue pointers into ArcGIS services.';
  refreshEl.disabled = true;
  if (fresh) groupsEl.innerHTML = '';
  try {
    const response = await fetch(`${endpoint}${fresh ? `?t=${Date.now()}` : ''}`, { headers: { accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || payload.status === 'error') throw new Error(payload.error || `HTTP ${response.status}`);
    currentMaps = payload.maps || null;
    statusEl.textContent = payload.status === 'ok' ? 'Live Southall evidence returned' : 'Probe completed — no observations matched yet';
    metaEl.textContent = `Generated ${new Date(payload.generatedAt).toLocaleString('en-GB')} · ${(payload.elapsedMs / 1000).toFixed(1)}s · ${payload.scope}`;
    renderScopeMap(currentMaps);
    groupsEl.innerHTML = (payload.groups || []).map(renderGroup).join('');
    renderGeographies(payload.geographyDiagnostics);
  } catch (error) {
    statusEl.textContent = 'Ealing Data probe failed';
    metaEl.textContent = String(error?.message || error);
    groupsEl.innerHTML = `<section class="probe-group"><div class="probe-error">${esc(error?.message || error)}</div></section>`;
    if (scopeMapEl) scopeMapEl.innerHTML = '<p class="probe-empty">Map unavailable while the probe is failing.</p>';
  } finally {
    refreshEl.disabled = false;
  }
}

refreshEl.addEventListener('click', () => load({ fresh: true }));
load();
