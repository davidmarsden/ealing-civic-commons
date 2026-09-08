const $ = (sel) => document.querySelector(sel);
const esc = (value) => String(value ?? '').replace(/[&<>'\"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const fmtDate = (iso) => iso ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00Z`)) : 'Date unavailable';
const placeSlug = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

let snapshot = null;

function populate(select, values) {
  for (const value of [...new Set(values.filter(Boolean))].sort()) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function recordCard(record) {
  const place = record.town ? `<a class="planning-place" href="/places/${esc(placeSlug(record.town))}">${esc(record.town)}</a>` : '<span class="planning-place muted">Place unclassified</span>';
  return `<article class="planning-card">
    <div class="planning-card-meta"><span class="source-pill official">Official record</span><span>${esc(record.reference)}</span><span>${esc(fmtDate(record.validated_date))}</span></div>
    <h2><a href="${esc(record.commons_path)}">${esc(record.address)}</a></h2>
    <p class="planning-proposal">${esc(record.proposal)}</p>
    <div class="planning-tags"><span class="tag">${esc(record.category)}</span><span class="tag">${esc(record.status)}</span>${record.out_of_borough ? '<span class="tag planning-out">Out of borough</span>' : ''}${place}</div>
    <div class="planning-actions"><a href="${esc(record.commons_path)}">Open Civic Commons object →</a><a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Open Ealing planning register ↗</a></div>
  </article>`;
}

function render() {
  const place = $('#planningPlace').value;
  const category = $('#planningCategory').value;
  const includeOut = $('#planningIncludeOut').checked;
  const records = (snapshot?.records || []).filter((record) => {
    if (!includeOut && record.out_of_borough) return false;
    if (place !== 'All' && (record.town || 'Unclassified') !== place) return false;
    if (category !== 'All' && record.category !== category) return false;
    return true;
  });
  $('#planningCount').textContent = `${records.length} application${records.length === 1 ? '' : 's'}`;
  $('#planningList').innerHTML = records.length ? records.map(recordCard).join('') : '<p class="empty">No applications match these filters.</p>';
}

async function init() {
  try {
    const response = await fetch('/data/planning-latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    snapshot = await response.json();
    populate($('#planningPlace'), [...snapshot.records.map((r) => r.town || 'Unclassified')]);
    populate($('#planningCategory'), snapshot.records.map((r) => r.category));
    $('#planningStatus').textContent = `Latest completed weekly list: ${snapshot.week}. Snapshot generated ${fmtDate(snapshot.generated_at.slice(0, 10))}.`;
    render();
  } catch (error) {
    $('#planningStatus').textContent = 'Planning snapshot is temporarily unavailable.';
    $('#planningList').innerHTML = '<p class="empty">The last published planning snapshot could not be loaded.</p>';
    console.error(error);
  }
}

['planningPlace', 'planningCategory', 'planningIncludeOut'].forEach((id) => document.addEventListener('change', (event) => { if (event.target.id === id) render(); }));
init();
