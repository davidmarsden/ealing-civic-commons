const entityRoute = new Map([
  ['person', 'people'],
  ['organisation', 'organisations'],
  ['place', 'places']
]);

let reviewedEntityRoutes = null;
let routesLoading = null;

function routeFromProviderEntity(entity) {
  const segment = entityRoute.get(entity?.type);
  const id = String(entity?.id || '');
  if (!segment || !id.startsWith('entity:')) return null;
  const slug = id.slice('entity:'.length);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  return `/${segment}/${slug}`;
}

async function loadReviewedEntityRoutes() {
  if (reviewedEntityRoutes) return reviewedEntityRoutes;
  if (routesLoading) return routesLoading;
  routesLoading = (async () => {
    const sourceLink = document.querySelector('.primary-source-link');
    const sourceUrl = sourceLink?.href;
    if (!sourceUrl || !sourceUrl.includes('southallstories.uk/')) return new Map();
    try {
      const endpoint = new URL('/.netlify/functions/civic-memory', location.origin);
      endpoint.searchParams.set('url', sourceUrl);
      const response = await fetch(endpoint);
      if (!response.ok) return new Map();
      const memory = await response.json();
      const routes = new Map();
      for (const entity of memory.entities || []) {
        const route = routeFromProviderEntity(entity);
        if (route) routes.set(`${entity.type}\u0000${entity.name}`, route);
      }
      reviewedEntityRoutes = routes;
      return routes;
    } catch (error) {
      console.warn('Civic entity routes unavailable', error);
      return new Map();
    }
  })();
  return routesLoading;
}

async function linkReviewedEntityTags() {
  const routes = await loadReviewedEntityRoutes();
  document.querySelectorAll('.memory-tag').forEach(tag => {
    if (tag.dataset.entityLinked === 'true' || tag.tagName === 'A') return;
    const label = tag.childNodes[0]?.textContent?.trim();
    const type = tag.querySelector('small')?.textContent?.trim();
    if (!label || !type) return;
    const href = routes.get(`${type}\u0000${label}`);
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.className = 'memory-tag memory-tag-link';
    link.dataset.entityLinked = 'true';
    link.setAttribute('aria-label', `Open Civic Commons ${type} page for ${label}`);
    while (tag.firstChild) link.appendChild(tag.firstChild);
    tag.replaceWith(link);
  });
}

async function arrangeMemoryColumns() {
  await linkReviewedEntityTags();
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
  await linkReviewedEntityTags();
}

const memoryRoot = document.getElementById('civicMemoryContent');
if (memoryRoot) {
  const observer = new MutationObserver(() => arrangeMemoryColumns());
  observer.observe(memoryRoot, { childList: true, subtree: true });
}
arrangeMemoryColumns();
