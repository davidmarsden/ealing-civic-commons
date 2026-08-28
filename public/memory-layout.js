function tuneMemoryPanels() {
  const grid = document.querySelector('.memory-grid');
  if (!grid || grid.dataset.tuned === 'true') return;
  const panels = [...grid.children].filter(child => child.classList.contains('memory-panel'));
  if (panels.length !== 4) return;

  const evidence = panels[2];
  const about = panels[3];
  evidence.classList.add('memory-evidence-wide');
  about.remove();
  grid.dataset.tuned = 'true';
}

const observer = new MutationObserver(tuneMemoryPanels);
const container = document.getElementById('civicMemoryContent');
if (container) observer.observe(container, { childList: true, subtree: true });
tuneMemoryPanels();
