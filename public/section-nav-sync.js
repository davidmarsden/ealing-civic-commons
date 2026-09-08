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

async function syncForLoadWindow() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    syncSectionNavigation();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

syncForLoadWindow();
window.addEventListener('hashchange', syncSectionNavigation);
