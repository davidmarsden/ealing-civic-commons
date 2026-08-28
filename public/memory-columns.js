function arrangeMemoryColumns() {
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
}

const memoryRoot = document.getElementById('civicMemoryContent');
if (memoryRoot) {
  const observer = new MutationObserver(arrangeMemoryColumns);
  observer.observe(memoryRoot, { childList: true, subtree: true });
}
arrangeMemoryColumns();
