const routeParts = location.pathname.split('/').filter(Boolean);
const slug = routeParts[1]?.replace(/\.html$/,'');
const entityId = slug ? `entity:${slug}` : null;

async function loadRelatedIssues() {
  if (!entityId) return;
  try {
    const endpoint = new URL('/.netlify/functions/civic-issues', location.origin);
    endpoint.searchParams.set('entityId', entityId);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.issues?.length) return;
    const sidebar = document.querySelector('.entity-sidebar');
    if (!sidebar) return;
    const panel = document.createElement('section');
    panel.className = 'panel entity-issues-panel';
    panel.innerHTML = `<p class="eyebrow">Ongoing issues</p><h3>Follow the wider civic question</h3><div class="entity-provider-list">${data.issues.map(issue => `<div class="entity-provider"><strong><a href="/${issue.route}">${issue.name}</a></strong><span>${issue.status} · ${issue.description}</span></div>`).join('')}</div>`;
    sidebar.insertBefore(panel, sidebar.children[1] || null);
  } catch (error) {
    console.warn('Related civic issues unavailable', error);
  }
}
loadRelatedIssues();
