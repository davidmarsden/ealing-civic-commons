const endpoint = '/.netlify/functions/ealing-data-probe';
const statusEl = document.querySelector('#probeStatus');
const metaEl = document.querySelector('#probeMeta');
const groupsEl = document.querySelector('#probeGroups');
const geoEl = document.querySelector('#geoDiagnostics');
const refreshEl = document.querySelector('#probeRefresh');

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));

function valueText(value, unit) {
  if (value === null || value === undefined || value === '') return '—';
  const raw = typeof value === 'number' ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value) : String(value);
  if (!unit) return raw;
  const normalized = String(unit).trim();
  if (!normalized) return raw;
  if (/^%|percent/i.test(normalized)) return `${raw}%`;
  return `${raw} ${normalized}`;
}

function renderInstance(instance) {
  if (instance.error) return `<div class="probe-instance"><div class="probe-error">${esc(instance.error)}</div></div>`;
  const observations = instance.observations || [];
  return `<div class="probe-instance">
    <div class="probe-instance-head"><strong>${esc(instance.date || 'Latest')}</strong><span>${esc(instance.geography?.name || '')}</span></div>
    ${observations.length ? `<div class="probe-values">${observations.map(obs => `<div class="probe-value"><span>${esc(obs.place)}</span><strong>${esc(valueText(obs.value, instance.unit))}</strong></div>`).join('')}</div>` : `<div class="probe-empty">No Southall observation matched safely for this instance.</div>`}
    <div class="probe-service">Field: ${esc(instance.fieldId || '—')} · matched rows: ${esc(instance.matchedRows ?? 0)}${instance.serviceUrl ? ` · ${esc(instance.serviceUrl)}` : ''}</div>
  </div>`;
}

function renderIndicator(indicator) {
  return `<article class="probe-card">
    <div><p class="eyebrow">${esc(indicator.id)}</p><h3>${esc(indicator.name)}</h3></div>
    <div class="probe-card-meta"><span class="probe-chip">${esc(indicator.geography?.name || 'Unknown geography')}</span>${indicator.dataType ? `<span class="probe-chip">${esc(indicator.dataType)}</span>` : ''}</div>
    ${(indicator.instances || []).map(renderInstance).join('') || '<div class="probe-empty">No matching instances selected.</div>'}
  </article>`;
}

function renderGroup(group) {
  const body = group.error
    ? `<div class="probe-error">${esc(group.error)}</div>`
    : group.warning
      ? `<div class="probe-warning">${esc(group.warning)}</div>`
      : `<div class="probe-grid">${(group.indicators || []).map(renderIndicator).join('')}</div>`;
  return `<section class="probe-group">
    <div class="probe-group-header"><div><p class="eyebrow">Ealing Data probe</p><h2>${esc(group.label)}</h2></div><span class="probe-candidate-count">${esc(group.candidates ?? 0)} catalogue candidates · ${(group.indicators || []).length} selected</span></div>
    ${body}
  </section>`;
}

function renderGeographies(rows) {
  geoEl.innerHTML = (rows || []).map(row => `<div class="geo-row"><strong>${esc(row.name)}</strong><span>${esc(row.matchedFeatures)} Southall features</span><span>${row.error ? esc(row.error) : `${esc(row.identifiers)} identifiers`}</span></div>`).join('') || '<p>No geography diagnostics returned.</p>';
}

async function load({ fresh = false } = {}) {
  statusEl.textContent = 'Loading Ealing Data…';
  metaEl.textContent = 'Following the public catalogue into ArcGIS services.';
  refreshEl.disabled = true;
  if (fresh) groupsEl.innerHTML = '';
  try {
    const response = await fetch(`${endpoint}${fresh ? `?t=${Date.now()}` : ''}`, { headers: { accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok || payload.status === 'error') throw new Error(payload.error || `HTTP ${response.status}`);
    statusEl.textContent = payload.status === 'ok' ? 'Live Southall evidence returned' : 'Probe completed — no observations matched yet';
    metaEl.textContent = `Generated ${new Date(payload.generatedAt).toLocaleString('en-GB')} · ${(payload.elapsedMs / 1000).toFixed(1)}s · ${payload.scope}`;
    groupsEl.innerHTML = (payload.groups || []).map(renderGroup).join('');
    renderGeographies(payload.geographyDiagnostics);
  } catch (error) {
    statusEl.textContent = 'Ealing Data probe failed';
    metaEl.textContent = String(error?.message || error);
    groupsEl.innerHTML = `<section class="probe-group"><div class="probe-error">${esc(error?.message || error)}</div></section>`;
  } finally {
    refreshEl.disabled = false;
  }
}

refreshEl.addEventListener('click', () => load({ fresh: true }));
load();
