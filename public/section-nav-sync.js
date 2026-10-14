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
  const existing = [...actions.querySelectorAll('a')].filter(link => known.has(link.getAttribute('href')));
  const wanted = SECTIONS.filter(([href]) => { const section = document.querySelector(href); return section && !section.hidden; });
  // Leave the DOM alone when the links already match. Other renderers observe the
  // hero, so rewriting identical links would wake them, and their writes wake this
  // observer again: a loop that froze place pages with a primary issue.
  const current = existing.map(link => `${link.getAttribute('href')}|${link.textContent}`).join('\n');
  const target = wanted.map(([href, label]) => `${href}|${label} ↓`).join('\n');
  if (current === target) return true;

  existing.forEach(link => link.remove());
  for (const [href, label] of wanted) {
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
