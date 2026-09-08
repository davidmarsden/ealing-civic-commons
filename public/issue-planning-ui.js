const esc = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt', "'":'&#39;', '\"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};

const SECTION_ORDER = ['currentSection','planningSection','sourcesSection','reportingSection','relationshipsSection','actorsSection'];
const ACTION_ORDER = ['#currentSection','#planningSection','#sourcesSection','#reportingSection','#relationshipsSection','#actorsSection'];
const FOLDED = new Map([
  ['sourcesSection','Primary evidence'],
  ['reportingSection','Historical reporting'],
  ['relationshipsSection','Reviewed connections']
]);
let planningReady = false;

function issueRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'issues' && parts[1] ? `issues/${parts[1].replace(/\.html$/i, '')}` : null;
}
function actionRoot() { return document.querySelector('#issueHero .entity-actions'); }
function reorderSections() {
  const stack = document.querySelector('.entity-stack');
  if (!stack) return;
  SECTION_ORDER.forEach(id => { const section = document.getElementById(id); if (section) stack.append(section); });
}
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
function ensureAction(href, label) {
  const actions = actionRoot();
  if (!actions) return false;
  if (!actions.querySelector(`a[href="${href}"]`)) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = `${label} ↓`;
    actions.append(link);
  }
  return true;
}
function syncActions() {
  const actions = actionRoot();
  if (!actions) return false;
  ensureAction('#currentSection','Current Commons');
  if (planningReady) ensureAction('#planningSection','Planning register');
  else actions.querySelector('a[href="#planningSection"]')?.remove();
  ensureAction('#sourcesSection','Primary evidence');
  ensureAction('#reportingSection','Historical reporting');
  ensureAction('#relationshipsSection','Reviewed connections');
  ensureAction('#actorsSection','Who & what');
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
  button.setAttribute('aria-expanded','false');
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
    button.setAttribute('aria-expanded','true');
    button.textContent = `Hide ${label.toLowerCase()}`;
    body.hidden = false;
  }
}
function expandHashTarget() {
  const id = location.hash.replace(/^#/,'');
  if (!FOLDED.has(id)) return;
  const section = document.getElementById(id);
  const button = section?.querySelector('.entity-section-toggle');
  const body = section?.querySelector('.entity-section-fold-body');
  if (!button || !body) return;
  button.setAttribute('aria-expanded','true');
  button.textContent = `Hide ${FOLDED.get(id).toLowerCase()}`;
  body.hidden = false;
}
function renderPlanning(records, primaryRoute) {
  const section = document.querySelector('#planningSection');
  const root = document.querySelector('#issuePlanning');
  if (!section || !root || !records.length) return false;
  root.innerHTML = `<ul class="entity-list">${records.map(record => {
    const link = (record.place_links || []).find(item => item.route === primaryRoute);
    const provenance = link?.provenance === 'reviewed-rule'
      ? `Reviewed site link${link.note ? ` · ${link.note}` : ''}`
      : 'Linked from conservative town classification';
    return `<li><span class="relationship-type">${esc(record.category || 'Planning application')}</span><h3><a href="${esc(record.commons_path)}">${esc(record.reference)} · ${esc(record.address)}</a></h3><p>${esc(record.proposal)}</p><span class="entity-meta">Validated ${esc(fmtDate(record.validated_date))} · ${esc(record.status || 'Status unavailable')}</span><span class="entity-meta">${esc(provenance)} · <a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Ealing Council planning record ↗</a></span></li>`;
  }).join('')}</ul>`;
  section.hidden = false;
  planningReady = true;
  syncActions();
  if (location.hash === '#planningSection') requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
  return true;
}
async function loadIssuePlanning() {
  const route = issueRoute();
  if (!route) return false;
  try {
    const issueEndpoint = new URL('/.netlify/functions/civic-issue', location.origin);
    issueEndpoint.searchParams.set('route', route);
    const [issueResponse, planningResponse] = await Promise.all([
      fetch(issueEndpoint, { cache:'no-store' }),
      fetch(`/data/planning-latest.json?issue=${Date.now()}`, { cache:'no-store' })
    ]);
    if (!issueResponse.ok || !planningResponse.ok) return false;
    const issueData = await issueResponse.json();
    const snapshot = await planningResponse.json();
    if (!issueData.matched || !issueData.issue?.primaryEntityId) return false;
    const primary = (issueData.entities || []).find(entity => entity.id === issueData.issue.primaryEntityId);
    const primaryRoute = primary?.commonsRoute;
    if (!primaryRoute) return false;
    const records = (snapshot.records || [])
      .filter(record => !record.out_of_borough && (record.place_links || []).some(link => link.route === primaryRoute))
      .sort((a,b) => (Date.parse(b.validated_date || '') || 0) - (Date.parse(a.validated_date || '') || 0));
    return renderPlanning(records, primaryRoute);
  } catch (error) {
    console.warn('Issue planning unavailable', error);
    return false;
  }
}
async function syncHeroWhenReady() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (syncActions()) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
async function initialiseDossier() {
  document.documentElement.classList.add('entity-dossier-ready');
  reorderSections();
  FOLDED.forEach((label,id) => foldSection(id,label));
  const planningPromise = loadIssuePlanning();
  await syncHeroWhenReady();
  await planningPromise;
  await syncHeroWhenReady();
  window.addEventListener('hashchange', () => {
    expandHashTarget();
    const target = document.getElementById(location.hash.replace(/^#/,''));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block:'start' }));
  });
}
initialiseDossier();
