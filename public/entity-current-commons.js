const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';

function routeInfo() {
  if (document.body.dataset.entityId) {
    const id = document.body.dataset.entityId.replace(/^entity:/, '');
    const type = document.body.dataset.entityType || null;
    const segment = type === 'person' ? 'people' : type === 'organisation' ? 'organisations' : 'places';
    return { route: `${segment}/${id}`, type };
  }
  const parts = location.pathname.split('/').filter(Boolean);
  return { route: parts.length >= 2 ? `${parts[0]}/${parts[1].replace(/\.html$/, '')}` : null, type: parts[0] === 'places' ? 'place' : null };
}

function linkedToRoute(item, route) {
  return (item?.placeLinks || []).some(link => link?.route === route);
}

function literalMatch(item, terms) {
  const text = `${item?.title || ''} ${item?.summary || ''}`.toLowerCase();
  return terms.some(term => term.length >= 5 && text.includes(term.toLowerCase()));
}

function render(items) {
  const section = document.querySelector('#currentSection');
  const root = document.querySelector('#currentItems');
  if (!section || !root || !items.length) return;
  section.hidden = false;
  root.innerHTML = items.map(item => `<article class="item"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><strong>${esc(item.source)}</strong><span>${esc(fmtDate(item.publishedAt))}</span></div><div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}${linkedToRoute(item, routeInfo().route) ? `<p class="entity-current-note">Linked to this place${(item.placeLinks || []).find(link => link.route === routeInfo().route)?.provenance === 'inferred-place-candidate' ? ' by a narrow contextual discovery rule' : ''}.</p>` : ''}</div></article>`).join('');
}

async function loadCurrentCommons() {
  const route = routeInfo();
  if (!route.route) return;
  try {
    const [entityResponse, feedResponse] = await Promise.all([
      fetch(`/.netlify/functions/civic-entity?route=${encodeURIComponent(route.route)}`, { cache:'no-store' }),
      fetch('/.netlify/functions/combined-feed', { cache:'no-store' })
    ]);
    if (!entityResponse.ok || !feedResponse.ok) return;
    const [entityData, feed] = await Promise.all([entityResponse.json(), feedResponse.json()]);
    if (!entityData?.matched) return;
    const entity = entityData.entity || {};
    const terms = [entity.name, ...(entity.aliases || [])].filter(Boolean).sort((a,b) => b.length - a.length);
    const matches = (feed.items || [])
      .filter(item => linkedToRoute(item, route.route) || literalMatch(item, terms))
      .sort((a,b) => (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0))
      .slice(0, 20);
    render(matches);
  } catch (error) {
    console.warn('Combined Current Commons unavailable', error);
  }
}

loadCurrentCommons();
