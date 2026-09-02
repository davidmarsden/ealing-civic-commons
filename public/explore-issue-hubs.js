const escAttr = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

function entityIdFromRoute(href) {
  try {
    const url = new URL(href, location.origin);
    const parts = url.pathname.split('/').filter(Boolean);
    if (!['people','organisations','places'].includes(parts[0]) || !parts[1]) return null;
    return `entity:${parts[1].replace(/\.html$/, '')}`;
  } catch {
    return null;
  }
}

(async () => {
  try {
    const response = await fetch('/.netlify/functions/civic-issues', { cache:'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const primary = new Map((data.issues || []).filter(issue => issue.primaryEntityId).map(issue => [issue.primaryEntityId, issue]));
    if (!primary.size) return;

    const directory = document.querySelector('#entityDirectory');
    if (!directory) return;

    let observer = null;
    const apply = () => {
      if (observer) observer.disconnect();
      directory.querySelectorAll('a.entity-card-main').forEach(link => {
        const entityId = link.dataset.entityId || entityIdFromRoute(link.getAttribute('href'));
        const issue = primary.get(entityId);
        if (!issue) return;
        link.dataset.entityId = entityId;
        link.href = `/${issue.route}`;
        link.dataset.issueHub = 'true';
        const card = link.closest('.entity-card');
        const meta = card?.querySelector('.entity-card-meta');
        if (meta && !meta.querySelector('[data-issue-hub-pill]')) {
          meta.insertAdjacentHTML('afterbegin', '<span class="entity-provider-pill" data-issue-hub-pill>Ongoing issue hub</span>');
        }
        const description = link.querySelector('p');
        if (description && !description.dataset.issueHubDescription) {
          description.dataset.issueHubDescription = 'true';
          description.textContent = issue.description || description.textContent;
        }
      });
      if (observer) observer.observe(directory, { childList:true, subtree:true });
    };

    observer = new MutationObserver(() => apply());
    apply();
  } catch (error) {
    console.warn('Explore issue-hub preference unavailable', error);
  }
})();
