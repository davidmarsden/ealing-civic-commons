function linkPilotEntityTags() {
  document.querySelectorAll('.memory-tag').forEach(tag => {
    if (tag.dataset.entityLinked === 'true') return;
    const label = tag.childNodes[0]?.textContent?.trim();
    if (label !== 'Southall Gasworks') return;
    const link = document.createElement('a');
    link.href = '/places/southall-gasworks.html';
    link.className = 'memory-tag memory-tag-link';
    link.dataset.entityLinked = 'true';
    while (tag.firstChild) link.appendChild(tag.firstChild);
    tag.replaceWith(link);
  });
}

function arrangeMemoryColumns() {
  linkPilotEntityTags();
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
  linkPilotEntityTags();
}

const memoryRoot = document.getElementById('civicMemoryContent');
if (memoryRoot) {
  const observer = new MutationObserver(arrangeMemoryColumns);
  observer.observe(memoryRoot, { childList: true, subtree: true });
}
arrangeMemoryColumns();
