function stackMemoryPanels() {
  const grid = document.querySelector('.memory-grid');
  if (!grid || grid.dataset.stacked === 'true') return;
  const panels = [...grid.children].filter(child => child.classList.contains('memory-panel'));
  if (panels.length !== 4) return;

  const left = document.createElement('div');
  const right = document.createElement('div');
  left.className = 'memory-column';
  right.className = 'memory-column';

  left.append(panels[0], panels[2]);
  right.append(panels[1], panels[3]);
  grid.replaceChildren(left, right);
  grid.dataset.stacked = 'true';
}

const observer = new MutationObserver(stackMemoryPanels);
observer.observe(document.getElementById('civicMemoryContent'), { childList: true, subtree: true });
stackMemoryPanels();
