const entityRoute = new Map([
  ['person', 'people'],
  ['organisation', 'organisations'],
  ['place', 'places']
]);

function slugifyEntityLabel(value) {
  return String(value || '').toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function linkReviewedEntityTags() {
  document.querySelectorAll('.memory-tag').forEach(tag => {
    if (tag.dataset.entityLinked === 'true' || tag.tagName === 'A') return;
    const type = tag.querySelector('small')?.textContent?.trim();
    const segment = entityRoute.get(type);
    if (!segment) return;
    const label = tag.childNodes[0]?.textContent?.trim();
    const slug = slugifyEntityLabel(label);
    if (!label || !slug) return;
    const link = document.createElement('a');
    link.href = `/${segment}/${slug}`;
    link.className = 'memory-tag memory-tag-link';
    link.dataset.entityLinked = 'true';
    link.setAttribute('aria-label', `Open Civic Commons ${type} page for ${label}`);
    while (tag.firstChild) link.appendChild(tag.firstChild);
    tag.replaceWith(link);
  });
}

function arrangeMemoryColumns() {
  linkReviewedEntityTags();
  const grid = document.querySelector('.memory-grid');
  if (!grid || grid.dataset.columnsArranged === 'true') return;

  const panels = [...grid.children].filter(child => child.classList.contains('memory-panel'));
  if (panels.length !== 4) return;

  const byHeading = new Map(
    panels.map(panel => [panel.querySelector('h3')?.textContent?.trim(), panel])
  );

  const primary = byHeading.get('Primary evidence');
  const related = byHeading.get('Related source material');
  const earlier = byHeading.get('Earlier reporting');
  const people = byHeading.get('People, organisations, places & topics');
  if (!primary || !related || !earlier || !people) return;

  const left = document.createElement('div');
  const right = document.createElement('div');
  left.className = 'memory-column';
  right.className = 'memory-column';

  left.append(primary, earlier);
  right.append(related, people);
  grid.replaceChildren(left, right);
  grid.dataset.columnsArranged = 'true';
  linkReviewedEntityTags();
}

const memoryRoot = document.getElementById('civicMemoryContent');
if (memoryRoot) {
  const observer = new MutationObserver(arrangeMemoryColumns);
  observer.observe(memoryRoot, { childList: true, subtree: true });
}
arrangeMemoryColumns();
