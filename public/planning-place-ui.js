const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};
const normaliseRoute = value => String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
const GASWORKS_ROUTE = 'places/southall-gasworks';
const GASWORKS_RULE_ID = 'southall-gasworks-2-the-straight';

function currentPlaceRoute() {
  const match = location.pathname.match(/^\/(places\/[^/]+)/i);
  return match ? normaliseRoute(match[1]) : null;
}

async function routeCandidates() {
  const routes = new Set();
  const pathRoute = currentPlaceRoute();
  if (pathRoute) routes.add(pathRoute);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const canonical = normaliseRoute(window.__civicEntityRoute);
    if (canonical) {
      routes.add(canonical);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return routes;
}

function matchingLink(record, routes) {
  const exact = (record.place_links || []).find(candidate => routes.has(normaliseRoute(candidate.route)));
  if (exact) return exact;
  if (!routes.has(GASWORKS_ROUTE)) return null;
  return (record.place_links || []).find(candidate => candidate.provenance === 'reviewed-rule' && candidate.rule_id === GASWORKS_RULE_ID) || null;
}

function ensurePlanningJump() {
  const actions = document.querySelector('#entityHero .entity-actions');
  if (!actions || actions.querySelector('a[href="#planningSection"]')) return;
  const link = document.createElement('a');
  link.href = '#planningSection';
  link.textContent = 'Planning register ↓';
  const reporting = actions.querySelector('a[href="#reportingSection"]');
  actions.insertBefore(link, reporting || null);
}

function renderPlanning(items, routes) {
  const section = document.querySelector('#planningSection');
  const root = document.querySelector('#planningItems');
  if (!section || !root || !items.length) return false;

  root.innerHTML = `<ul class="entity-list">${items.map(record => {
    const link = matchingLink(record, routes);
    const provenance = link?.provenance === 'reviewed-rule'
      ? `Reviewed site link${link.note ? ` · ${link.note}` : ''}`
      : 'Linked from conservative town classification';
    return `<li><span class="relationship-type">${esc(record.category || 'Planning application')}</span><h3><a href="${esc(record.commons_path)}">${esc(record.reference)} · ${esc(record.address)}</a></h3><p>${esc(record.proposal)}</p><span class="entity-meta">Validated ${esc(fmtDate(record.validated_date))} · ${esc(record.status || 'Status unavailable')}</span><span class="entity-meta">${esc(provenance)} · <a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Ealing Council planning record ↗</a></span></li>`;
  }).join('')}</ul>`;

  section.hidden = false;
  ensurePlanningJump();
  if (location.hash === '#planningSection') {
    requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
  }
  return true;
}

async function loadPlanningPlaceHistory() {
  const routes = await routeCandidates();
  if (!routes.size) return;

  try {
    const response = await fetch('/data/planning-latest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Planning snapshot HTTP ${response.status}`);
    const snapshot = await response.json();
    const items = (snapshot.records || [])
      .filter(record => !record.out_of_borough && matchingLink(record, routes))
      .sort((a, b) => (Date.parse(b.validated_date || '') || 0) - (Date.parse(a.validated_date || '') || 0));
    renderPlanning(items, routes);
  } catch (error) {
    console.warn('Planning place history unavailable', error);
  }
}

loadPlanningPlaceHistory();
