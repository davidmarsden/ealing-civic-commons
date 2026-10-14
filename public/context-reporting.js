const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};

function canonicalUrl(value) {
  try {
    const url = new URL(value, location.origin);
    url.hash = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(value || '').trim();
  }
}

function mergeHistorical(reviewed, archived, currentUrls, placeLinked = []) {
  const seen = new Set(currentUrls);
  const combined = [];
  const add = item => {
    const key = canonicalUrl(item?.url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    combined.push(item);
  };

  (reviewed || []).forEach(post => add({
    ...post,
    source: post.source || 'Southall Stories',
    date: post.date || post.publishedAt || null,
    reviewedMatch: true
  }));

  (archived || []).slice(0, 20).forEach(record => {
    const item = record?.item;
    if (!item?.url) return;
    add({
      title: item.title,
      url: item.url,
      summary: item.summary,
      date: item.publishedAt || record.archivedAt,
      source: item.source || 'Archived publisher',
      archivedMatch: true,
      matchScore: record.matchScore || null
    });
  });

  (placeLinked || []).forEach(record => {
    const item = record?.item;
    if (!item?.url) return;
    add({
      title: item.title,
      url: item.url,
      summary: item.summary,
      date: item.publishedAt || record.archivedAt,
      source: item.source || 'Publisher',
      placeLinkedMatch: true
    });
  });

  return combined.sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
}

function routeContext() {
  const parts = location.pathname.split('/').filter(Boolean);
  const segment = parts[0];
  const slug = parts[1]?.replace(/\.html$/, '');
  if (!slug || !['people','organisations','places'].includes(segment)) return null;
  return { kind:'entity', route:`${segment}/${slug}`, segment, slug };
}

function entityReady() {
  if (window.__civicEntityReady) return Promise.resolve(window.__civicEntityReady);
  return new Promise(resolve => window.addEventListener('civic-entity:ready', event => resolve(event.detail), { once: true }));
}

function termsFor(entity) {
  return [entity?.name, ...(entity?.aliases || [])].filter(Boolean);
}

async function fetchHistorical(terms) {
  const endpoint = new URL('/.netlify/functions/historical-reporting', location.origin);
  [...new Set(terms)].slice(0, 20).forEach(term => endpoint.searchParams.append('term', term));
  endpoint.searchParams.set('limit', '20');
  const response = await fetch(endpoint, { cache:'no-store' });
  if (!response.ok) return [];
  return (await response.json()).records || [];
}

// Archive records explicitly linked to a place (formerly appended to the list by
// place-records-ui.js after this module had rendered it).
async function fetchPlaceLinked(route) {
  if (route.segment !== 'places') return [];
  const endpoint = new URL('/.netlify/functions/historical-reporting', location.origin);
  endpoint.searchParams.set('place', route.route);
  endpoint.searchParams.set('limit', '100');
  const response = await fetch(endpoint, { cache:'no-store' }).catch(() => null);
  if (!response?.ok) return [];
  return (await response.json()).records || [];
}

function currentCommonsUrls(route) {
  const published = window.__civicCurrentCommons;
  if (published?.route === route) return Promise.resolve(new Set((published.urls || []).map(canonicalUrl)));
  return new Promise(resolve => {
    const onReady = event => {
      if (event.detail?.route !== route) return;
      window.removeEventListener('civic-current-commons:ready', onReady);
      resolve(new Set((event.detail.urls || []).map(canonicalUrl)));
    };
    window.addEventListener('civic-current-commons:ready', onReady);
  });
}

function renderHistorical(items) {
  const root = document.querySelector('#reporting');
  const section = document.querySelector('#reportingSection');
  if (!root || !section) return;
  const stat = document.querySelector('#entityStats [data-reporting-count]');
  if (stat) stat.textContent = String(items.length);
  if (!items.length) {
    section.hidden = true;
    root.innerHTML = '';
    return;
  }
  section.hidden = false;
  root.innerHTML = `<ul class="entity-list">${items.map(post => `<li><h3><a href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">${esc(post.title)}</a></h3>${post.summary ? `<p>${esc(post.summary)}</p>` : ''}<span class="entity-meta">${esc(post.source || 'Publisher')} · ${esc(fmtDate(post.date))}${post.reviewedMatch ? ' · reviewed match' : post.placeLinkedMatch ? ' · place-linked Civic Archive match' : ' · Civic Archive match'}</span></li>`).join('')}</ul>`;
}

// A place whose reporting lives on a curated issue page shows a hub instead of its
// own Current Commons and historical reporting. The decision is page state, set
// once on <html> (data-primary-issue): CSS hides those sections whatever other
// renderers do with `hidden`, and section-nav-sync.js leaves their links out.
// This replaces a MutationObserver that re-applied the hub on every change and,
// together with section navigation, kept place pages busy indefinitely.
function renderPrimaryIssueHub(issue) {
  document.documentElement.dataset.primaryIssue = issue.route;
  window.dispatchEvent(new CustomEvent('civic-entity:primary-issue', { detail: { route: issue.route } }));

  const stats = document.querySelector('#entityStats .entity-stat:first-child');
  if (stats) stats.innerHTML = '<strong>1</strong><span>main civic issue</span>';

  const actions = document.querySelector('#entityHero .entity-actions');
  if (actions && !actions.querySelector('[data-primary-issue-link]')) {
    actions.insertAdjacentHTML('afterbegin', `<a data-primary-issue-link href="/${esc(issue.route)}">Main civic issue →</a>`);
  }

  if (document.querySelector('#primaryIssueHub')) return;
  const section = document.createElement('section');
  section.id = 'primaryIssueHub';
  section.className = 'entity-section';
  section.innerHTML = `<p class="eyebrow">Main civic issue</p><h2><a href="/${esc(issue.route)}">${esc(issue.name)} →</a></h2><p>${esc(issue.description || '')}</p><p class="entity-current-note">This place remains a factual node in the civic graph. Current reporting and historical narrative are gathered on the curated issue page to avoid duplicating the same material in two places.</p>`;
  const stack = document.querySelector('.entity-stack');
  const relationships = document.querySelector('#relationshipsSection');
  if (stack) stack.insertBefore(section, relationships || stack.firstChild);
}

async function primaryIssueForEntity(entity) {
  const entityId = entity?.id;
  if (!entityId) return null;
  const endpoint = new URL('/.netlify/functions/civic-issues', location.origin);
  endpoint.searchParams.set('entityId', entityId);
  const response = await fetch(endpoint, { cache:'no-store' });
  if (!response.ok) return null;
  const result = await response.json();
  return (result.issues || []).find(issue => issue.isPrimaryForEntity) || null;
}

// Entity pages only. This module owns historical reporting (#reporting) and the
// primary-issue hub. Current Commons belongs to entity-current-commons.js; issue
// and topic pages render their own sections in issue.js and topic.js.
const route = routeContext();
if (route) {
  (async () => {
    try {
      const ready = await entityReady();
      const entity = ready?.entity;
      if (!entity) return;
      const primaryIssue = await primaryIssueForEntity(entity).catch(() => null);
      if (primaryIssue) {
        renderPrimaryIssueHub(primaryIssue);
        return;
      }
      const [archived, placeLinked, currentUrls] = await Promise.all([
        fetchHistorical(termsFor(entity)),
        fetchPlaceLinked(route),
        currentCommonsUrls(route.route)
      ]);
      // Reviewed reporting comes with entity.js's ready event; Current Commons URLs are left out
      // so the same record is not listed in both sections.
      renderHistorical(mergeHistorical(ready.reporting || [], archived, currentUrls, placeLinked));
    } catch (error) {
      console.warn('Historical reporting unavailable', error);
    }
  })();
}
