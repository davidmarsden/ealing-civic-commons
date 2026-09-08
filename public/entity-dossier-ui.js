const esc = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt', "'":'&#39;', '\"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};
const normaliseRoute = value => String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');

const SECTION_ORDER = [
  'commonsAssertionsSection',
  'localEvidenceSection',
  'currentSection',
  'planningSection',
  'sourcesSection',
  'reportingSection',
  'relationshipsSection'
];
const ACTION_ORDER = [
  '#commonsAssertionsSection',
  '#currentSection',
  '#planningSection',
  '#sourcesSection',
  '#reportingSection',
  '#relationshipsSection'
];
const FOLDED = new Map([
  ['sourcesSection', 'Primary evidence'],
  ['reportingSection', 'Historical reporting'],
  ['relationshipsSection', 'Reviewed connections']
]);
let planningReady = false;

function currentPlaceRoute() {
  const match = location.pathname.match(/^\/(places\/[^/]+)/i);
  return match ? normaliseRoute(match[1]) : null;
}
function reorderSections() {
  const stack = document.querySelector('.entity-stack');
  if (!stack) return;
  SECTION_ORDER.forEach(id => { const section = document.getElementById(id); if (section) stack.append(section); });
}
function actionRoot() { return document.querySelector('#entityHero .entity-actions, .entity-actions'); }
function reorderActions() {
  const actions = actionRoot();
  if (!actions) return false;
  const byHref = new Map([...actions.querySelectorAll('a')].map(link => [link.getAttribute('href'), link]));
  ACTION_ORDER.forEach(href => {
    const link = byHref.get(href);
    if (link && link !== actions.lastElementChild) actions.append(link);
  });
  return true;
}
function removePlanningAction() {
  actionRoot()?.querySelector('a[href="#planningSection"]')?.remove();
}
function ensurePlanningAction() {
  const actions = actionRoot();
  if (!actions || !planningReady) return false;
  let link = actions.querySelector('a[href="#planningSection"]');
  if (!link) {
    link = document.createElement('a');
    link.href = '#planningSection';
    link.textContent = 'Planning register ↓';
    actions.append(link);
  }
  reorderActions();
  return true;
}
function foldSection(id, label) {
  const section = document.getElementById(id);
  if (!section || section.dataset.foldReady === 'true') return;
  section.dataset.foldReady = 'true';
  section.classList.add('entity-section-foldable');
  const heading = section.querySelector('h2');
  if (!heading) return;
  const body = document.createElement('div');
  body.className = 'entity-section-fold-body';
  while (heading.nextSibling) body.append(heading.nextSibling);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'entity-section-toggle';
  button.setAttribute('aria-expanded', 'false');
  button.textContent = `Show ${label.toLowerCase()}`;
  body.hidden = true;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    button.textContent = expanded ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`;
    body.hidden = expanded;
  });
  section.append(button, body);
  if (location.hash === `#${id}`) {
    button.setAttribute('aria-expanded', 'true');
    button.textContent = `Hide ${label.toLowerCase()}`;
    body.hidden = false;
  }
}
function expandHashTarget() {
  const id = location.hash.replace(/^#/, '');
  if (!FOLDED.has(id)) return;
  const section = document.getElementById(id);
  const button = section?.querySelector('.entity-section-toggle');
  const body = section?.querySelector('.entity-section-fold-body');
  if (!button || !body) return;
  button.setAttribute('aria-expanded', 'true');
  button.textContent = `Hide ${FOLDED.get(id).toLowerCase()}`;
  body.hidden = false;
}
function matchingPlanningLink(record, route) {
  const links = record.place_links || [];
  return links.find(link => normaliseRoute(link.route) === route)
    || (route === 'places/southall-gasworks' ? links.find(link => link.rule_id === 'southall-gasworks-2-the-straight') : null)
    || null;
}
async function renderPlacePlanning() {
  const route = normaliseRoute(window.__civicEntityRoute) || currentPlaceRoute();
  if (!route?.startsWith('places/')) return false;
  const section = document.getElementById('planningSection');
  const root = document.getElementById('planningItems');
  if (!section || !root) return false;
  try {
    const response = await fetch(`/data/planning-latest.json?dossier=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Planning snapshot HTTP ${response.status}`);
    const snapshot = await response.json();
    const matches = (snapshot.records || [])
      .filter(record => !record.out_of_borough && matchingPlanningLink(record, route))
      .sort((a,b) => (Date.parse(b.validated_date || '') || 0) - (Date.parse(a.validated_date || '') || 0));
    if (!matches.length) return false;
    root.innerHTML = `<ul class="entity-list">${matches.map(record => {
      const link = matchingPlanningLink(record, route);
      const provenance = link?.provenance === 'reviewed-rule'
        ? `Reviewed site link${link.note ? ` · ${link.note}` : ''}`
        : 'Linked from conservative town classification';
      return `<li><span class="relationship-type">${esc(record.category || 'Planning application')}</span><h3><a href="${esc(record.commons_path)}">${esc(record.reference)} · ${esc(record.address)}</a></h3><p>${esc(record.proposal)}</p><span class="entity-meta">Validated ${esc(fmtDate(record.validated_date))} · ${esc(record.status || 'Status unavailable')}</span><span class="entity-meta">${esc(provenance)} · <a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Ealing Council planning record ↗</a></span></li>`;
    }).join('')}</ul>`;
    section.hidden = false;
    planningReady = true;
    ensurePlanningAction();
    if (location.hash === '#planningSection') requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
    return true;
  } catch (error) {
    console.warn('Planning dossier unavailable', error);
    return false;
  }
}
async function renderPlanningWithRetry() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await renderPlacePlanning()) return true;
    await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
  }
  return false;
}
async function syncHeroWhenReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const actions = actionRoot();
    if (actions) {
      if (planningReady) ensurePlanningAction(); else removePlanningAction();
      reorderActions();
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
async function initialise() {
  document.documentElement.classList.add('entity-dossier-ready');
  reorderSections();
  FOLDED.forEach((label, id) => foldSection(id, label));
  const planningPromise = renderPlanningWithRetry();
  await syncHeroWhenReady();
  await planningPromise;
  await syncHeroWhenReady();
  window.addEventListener('hashchange', () => {
    expandHashTarget();
    const target = document.getElementById(location.hash.replace(/^#/, ''));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  });
}
initialise();
