const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};

const SECTIONS = [
  { id: 'currentSection', label: 'Current Commons', open: true },
  { id: 'planningSection', label: 'Planning register', open: true },
  { id: 'sourcesSection', label: 'Primary evidence', open: false },
  { id: 'reportingSection', label: 'Historical reporting', open: false },
  { id: 'relationshipsSection', label: 'Reviewed connections', open: false },
  { id: 'actorsSection', label: 'Who & what', open: false }
];

async function loadPlanningStore(queryKey) {
  for (const path of ['/data/planning-archive.json', '/data/planning-latest.json']) {
    const response = await fetch(`${path}?${queryKey}=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error(`Planning store HTTP ${response.status}: ${path}`);
  }
  throw new Error('No published planning store available');
}

function ensureCardStyles() {
  if (document.querySelector('link[data-dossier-cards]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/dossier-cards.css?v=20260908-1';
  link.dataset.dossierCards = 'true';
  document.head.append(link);
}

function issueRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'issues' && parts[1] ? `issues/${parts[1].replace(/\.html$/i, '')}` : null;
}

function reorderSections() {
  const stack = document.querySelector('.entity-stack');
  if (!stack) return;
  SECTIONS.forEach(({ id }) => {
    const section = document.getElementById(id);
    if (section) stack.append(section);
  });
}

function setCardExpanded(section, expanded) {
  const header = section.querySelector('.dossier-card-header');
  const body = section.querySelector('.dossier-card-body');
  if (!header || !body) return;
  header.setAttribute('aria-expanded', String(expanded));
  body.hidden = !expanded;
  section.classList.toggle('dossier-card-collapsed', !expanded);
  const state = header.querySelector('.dossier-card-state');
  if (state) state.textContent = expanded ? 'Hide' : 'Show';
  const chevron = header.querySelector('.dossier-card-chevron');
  if (chevron) chevron.textContent = expanded ? '−' : '+';
}

function prepareCard(config) {
  const section = document.getElementById(config.id);
  if (!section || section.dataset.dossierCardReady === 'true') return;
  section.dataset.dossierCardReady = 'true';
  section.classList.add('dossier-card');

  const eyebrow = section.querySelector(':scope > .eyebrow');
  const heading = section.querySelector(':scope > h2');
  if (!heading) return;

  const header = document.createElement('div');
  header.className = 'dossier-card-header';
  header.setAttribute('role', 'button');
  header.tabIndex = 0;
  header.setAttribute('aria-controls', `${config.id}Body`);
  header.innerHTML = `<div class="dossier-card-heading"><span class="dossier-card-eyebrow">${esc(eyebrow?.textContent || config.label)}</span><span class="dossier-card-title">${esc(heading.textContent)}</span></div><span class="dossier-card-control"><span class="dossier-card-state"></span><span class="dossier-card-chevron" aria-hidden="true"></span></span>`;

  const body = document.createElement('div');
  body.className = 'dossier-card-body';
  body.id = `${config.id}Body`;
  eyebrow?.remove();
  heading.remove();
  while (section.firstChild) body.append(section.firstChild);
  section.append(header, body);

  const toggle = () => setCardExpanded(section, header.getAttribute('aria-expanded') !== 'true');
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  });

  setCardExpanded(section, location.hash === `#${config.id}` || config.open);
}

function expandHashTarget() {
  const id = location.hash.replace(/^#/, '');
  const section = document.getElementById(id);
  if (!section?.classList.contains('dossier-card')) return;
  setCardExpanded(section, true);
}

function renderPlanning(records, primaryRoute) {
  const section = document.getElementById('planningSection');
  const root = document.getElementById('issuePlanning');
  if (!section || !root || !records.length) return false;
  root.innerHTML = `<ul class="entity-list">${records.map(record => {
    const link = (record.place_links || []).find(item => item.route === primaryRoute);
    const provenance = link?.provenance === 'reviewed-rule'
      ? `Reviewed site link${link.note ? ` · ${link.note}` : ''}`
      : 'Linked from conservative town classification';
    return `<li><span class="relationship-type">${esc(record.category || 'Planning application')}</span><h3><a href="${esc(record.commons_path)}">${esc(record.reference)} · ${esc(record.address)}</a></h3><p>${esc(record.proposal)}</p><span class="entity-meta">Validated ${esc(fmtDate(record.validated_date))} · ${esc(record.status || 'Status unavailable')}</span><span class="entity-meta">${esc(provenance)} · <a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Ealing Council planning record ↗</a></span></li>`;
  }).join('')}</ul>`;
  section.hidden = false;
  setCardExpanded(section, true);
  if (location.hash === '#planningSection') requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
  return true;
}

async function loadIssuePlanning() {
  const route = issueRoute();
  if (!route) return false;
  try {
    const issueEndpoint = new URL('/.netlify/functions/civic-issue', location.origin);
    issueEndpoint.searchParams.set('route', route);
    const [issueResponse, snapshot] = await Promise.all([
      fetch(issueEndpoint, { cache: 'no-store' }),
      loadPlanningStore('issue')
    ]);
    if (!issueResponse.ok) return false;
    const issueData = await issueResponse.json();
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

async function initialise() {
  ensureCardStyles();
  document.documentElement.classList.add('entity-dossier-ready');
  reorderSections();
  SECTIONS.forEach(prepareCard);
  await loadIssuePlanning();
  window.addEventListener('hashchange', () => {
    expandHashTarget();
    const target = document.getElementById(location.hash.replace(/^#/, ''));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  });
}

// This module owns issue dossier cards and planning content only. Hero section
// navigation is owned exclusively by section-nav-sync.js.
initialise();
