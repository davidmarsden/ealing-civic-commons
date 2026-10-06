const path = location.pathname;
const isIssue = path.startsWith('/issues/');

const SECTIONS = isIssue ? [
  ['#currentSection', 'Current Commons'],
  ['#planningSection', 'Planning register'],
  ['#sourcesSection', 'Primary evidence'],
  ['#reportingSection', 'Historical reporting'],
  ['#relationshipsSection', 'Reviewed connections'],
  ['#actorsSection', 'Who & what']
] : [
  ['#commonsAssertionsSection', 'Current civic facts'],
  ['#localEvidenceSection', 'Local evidence'],
  ['#currentSection', 'Current Commons'],
  ['#planningSection', 'Planning register'],
  ['#sourcesSection', 'Primary evidence'],
  ['#reportingSection', 'Historical reporting'],
  ['#relationshipsSection', 'Reviewed connections']
];

function actionRoot() {
  return isIssue
    ? document.querySelector('#issueHero .entity-actions')
    : document.querySelector('#entityHero .entity-actions, .entity-actions');
}

function syncSectionNavigation() {
  const actions = actionRoot();
  if (!actions) return false;

  const known = new Set(SECTIONS.map(([href]) => href));
  for (const link of [...actions.querySelectorAll('a')]) {
    const href = link.getAttribute('href');
    if (known.has(href)) link.remove();
  }

  for (const [href, label] of SECTIONS) {
    const section = document.querySelector(href);
    if (!section || section.hidden) continue;
    const link = document.createElement('a');
    link.href = href;
    link.textContent = `${label} ↓`;
    actions.append(link);
  }
  return true;
}

// Section navigation is the sole owner of standard hero section links. Content
// renderers own their sections and toggle `hidden`; navigation reacts to those
// visibility changes. The short-lived hero observer handles initial creation of
// the actions container without a timed retry loop.
const sections = SECTIONS.map(([href]) => document.querySelector(href)).filter(Boolean);
const sectionObserver = new MutationObserver(syncSectionNavigation);
sections.forEach(section => sectionObserver.observe(section, { attributes: true, attributeFilter: ['hidden'] }));

const hero = document.querySelector(isIssue ? '#issueHero' : '#entityHero');
let heroObserver = null;
if (hero && !actionRoot()) {
  heroObserver = new MutationObserver(() => {
    if (!actionRoot()) return;
    heroObserver.disconnect();
    heroObserver = null;
    syncSectionNavigation();
  });
  heroObserver.observe(hero, { childList: true, subtree: true });
}

syncSectionNavigation();
window.addEventListener('civic-entity:ready', syncSectionNavigation);
window.addEventListener('hashchange', syncSectionNavigation);
