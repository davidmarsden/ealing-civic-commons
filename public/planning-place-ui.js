const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};

function currentPlaceRoute() {
  const match = location.pathname.match(/^\/(places\/[^/]+)/i);
  return match ? match[1].replace(/\.html$/i, '') : null;
}

function planningJump() {
  return document.querySelector('.entity-actions a[href="#planningSection"]');
}

function hidePlanningUI() {
  const section = document.querySelector('#planningSection');
  if (section) section.hidden = true;
  const jump = planningJump();
  if (jump) jump.hidden = true;
}

function renderPlanning(items, route) {
  const section = document.querySelector('#planningSection');
  const root = document.querySelector('#planningItems');
  if (!section || !root || !items.length) return false;

  root.innerHTML = `<ul class="entity-list">${items.map(record => {
    const link = (record.place_links || []).find(candidate => candidate.route === route);
    const provenance = link?.provenance === 'reviewed-rule'
      ? `Reviewed site link${link.note ? ` · ${link.note}` : ''}`
      : 'Linked from conservative town classification';
    return `<li><span class="relationship-type">${esc(record.category || 'Planning application')}</span><h3><a href="${esc(record.commons_path)}">${esc(record.reference)} · ${esc(record.address)}</a></h3><p>${esc(record.proposal)}</p><span class="entity-meta">Validated ${esc(fmtDate(record.validated_date))} · ${esc(record.status || 'Status unavailable')}</span><span class="entity-meta">${esc(provenance)} · <a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Ealing Council planning record ↗</a></span></li>`;
  }).join('')}</ul>`;

  section.hidden = false;
  const jump = planningJump();
  if (jump) jump.hidden = false;

  if (location.hash === '#planningSection') {
    requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
  }
  return true;
}

async function loadPlanningPlaceHistory() {
  const route = currentPlaceRoute();
  if (!route) return;
  hidePlanningUI();

  try {
    const response = await fetch('/data/planning-latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Planning snapshot HTTP ${response.status}`);
    const snapshot = await response.json();
    const items = (snapshot.records || [])
      .filter(record => !record.out_of_borough && (record.place_links || []).some(link => link.route === route))
      .sort((a, b) => (Date.parse(b.validated_date || '') || 0) - (Date.parse(a.validated_date || '') || 0));
    renderPlanning(items, route);
  } catch (error) {
    console.warn('Planning place history unavailable', error);
  }
}

loadPlanningPlaceHistory();
