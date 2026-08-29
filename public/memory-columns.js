const verifiedEntityRoutes = new Map([
  ['Southall Gasworks', '/places/southall-gasworks'],
  ['Ealing Council', '/organisations/ealing-council'],
  ['Peter Mason', '/people/peter-mason']
]);

function linkReviewedEntityTags() {
  document.querySelectorAll('.memory-tag').forEach(tag => {
    if (tag.dataset.entityLinked === 'true' || tag.tagName === 'A') return;
    const label = tag.childNodes[0]?.textContent?.trim();
    const href = verifiedEntityRoutes.get(label);
    if (!href) return;
    const type = tag.querySelector('small')?.textContent?.trim() || 'entity';
    const link = document.createElement('a');
    link.href = href;
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
