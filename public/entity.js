const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(d); };
const labelType = value => String(value || '').replaceAll('_',' ');
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const routeType = new Map([['people','person'],['organisations','organisation'],['places','place']]);
const routeSegment = new Map([['person','people'],['organisation','organisations'],['place','places']]);
const typeLabel = new Map([['person','person'],['organisation','organisation'],['place','place']]);

function routeInfo() {
  if (document.body.dataset.entityId) {
    return { id: document.body.dataset.entityId, expectedType: document.body.dataset.entityType || null, slug: document.body.dataset.entityId.replace(/^entity:/,''), segment: null };
  }
  const parts = location.pathname.split('/').filter(Boolean);
  const segment = parts[0];
  const slug = parts[1]?.replace(/\.html$/,'');
  return { id: slug ? `entity:${slug}` : null, expectedType: routeType.get(segment) || null, slug, segment };
}

function entityPath(entity) {
  const segment = routeSegment.get(entity?.type);
  const slug = String(entity?.id || '').replace(/^entity:/,'');
  return segment && slug ? `/${segment}/${encodeURIComponent(slug)}` : null;
}

function entityLink(entity, label = entity?.name) {
  const path = entityPath(entity);
  return path ? `<a class="entity-inline-link" href="${esc(path)}">${esc(label)}</a>` : esc(label);
}

function renderHero(data) {
  const entity = data.entity;
  document.title = `${entity.name} — Civic Commons`;
  const eyebrow = $('#entityEyebrow');
  if (eyebrow) eyebrow.textContent = `Civic ${typeLabel.get(entity.type) || 'entity'}`;
  const relationshipsHeading = $('#relationshipsHeading');
  if (relationshipsHeading) relationshipsHeading.textContent = entity.type === 'person' ? 'Who and what connects to this person?' : entity.type === 'organisation' ? 'Who and what connects to this organisation?' : 'Who and what connects to this place?';
  const topicsHeading = $('#topicsHeading');
  if (topicsHeading) topicsHeading.textContent = entity.type === 'person' ? 'Topics around this person' : entity.type === 'organisation' ? 'Topics around this organisation' : 'Topics around this place';
  $('#entityStatus').hidden = true;
  const hero = $('#entityHero'); hero.hidden = false;
  const fallback = entity.type === 'person' ? 'A reviewed person in the civic-memory graph.' : entity.type === 'organisation' ? 'A reviewed organisation in the civic-memory graph.' : 'A reviewed place in the civic-memory graph.';
  hero.innerHTML = `<h1>${esc(entity.name)}</h1><p class="lede">${esc(entity.description || fallback)}</p><div class="entity-kicker"><span class="tag">${esc(entity.type)}</span>${(entity.aliases || []).slice(0,5).map(alias => `<span class="tag">also: ${esc(alias)}</span>`).join('')}</div><div class="entity-actions"><a href="#relationshipsSection">Reviewed connections ↓</a><a href="#sourcesSection">Primary evidence ↓</a><a href="#reportingSection">Historical reporting ↓</a><a href="#currentSection">Current Commons ↓</a></div>`;
}

function renderStats(data) {
  const c = data.counts || {};
  $('#entityStats').innerHTML = `<div class="entity-stat"><strong>${c.reporting || 0}</strong><span>archive posts</span></div><div class="entity-stat"><strong>${c.relationships || 0}</strong><span>reviewed relationships</span></div><div class="entity-stat"><strong>${c.sources || 0}</strong><span>curated sources</span></div>`;
  $('#entityTopics').innerHTML = (data.topics || []).map(topic => `<span class="entity-topic">${esc(topic.name)} · ${topic.count}</span>`).join('') || '<span class="entity-empty">No recurring topics found.</span>';
}

function renderRelationships(items, entity) {
  const section = $('#relationshipsSection');
  if (!items?.length) return;
  section.hidden = false;
  $('#relationships').innerHTML = `<ul class="entity-list">${items.map(rel => {
    const from = rel.direction === 'outgoing' ? entityLink(entity) : entityLink(rel.other);
    const to = rel.direction === 'outgoing' ? entityLink(rel.other) : entityLink(entity);
    return `<li><span class="relationship-type">${esc(labelType(rel.type))}</span><h3>${from} → ${to}</h3>${rel.note ? `<p class="relationship-note">${esc(rel.note)}</p>` : ''}${rel.validFrom || rel.validTo ? `<span class="entity-meta">Period: ${esc(rel.validFrom || 'unknown')} → ${esc(rel.validTo || 'present / unknown')}</span>` : ''}${rel.evidence?.length ? `<span class="entity-meta">Evidence: ${rel.evidence.map(ev => ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(ev.title)}</a>` : esc(ev.title)).join(' · ')}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function renderSources(items) {
  const section = $('#sourcesSection'); if (!items?.length) return; section.hidden = false;
  $('#sources').innerHTML = `<ul class="entity-list">${items.map(source => `<li><h3>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>` : esc(source.title)}</h3><span class="entity-meta">${esc(source.publisher || 'Source')} · ${esc(labelType(source.sourceType))}${source.date ? ` · ${esc(fmtDate(source.date))}` : ''}</span>${source.archiveUrls?.length ? `<span class="entity-meta">Archived copy available</span>` : ''}</li>`).join('')}</ul>`;
}

function renderReporting(items) {
  const section = $('#reportingSection'); if (!items?.length) return; section.hidden = false;
  $('#reporting').innerHTML = `<ul class="entity-list">${items.map(post => `<li><h3><a href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">${esc(post.title)}</a></h3>${post.summary ? `<p>${esc(post.summary)}</p>` : ''}<span class="entity-meta">Southall Stories · ${esc(fmtDate(post.date))}</span></li>`).join('')}</ul>`;
}

function currentMatches(feed, entity) {
  const terms = [entity.name, ...(entity.aliases || [])].filter(Boolean).sort((a,b) => b.length-a.length);
  return (feed?.items || []).filter(item => {
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    return terms.some(term => term.length >= 5 && text.includes(term.toLowerCase()));
  }).slice(0,12);
}

function renderCurrent(items) {
  const section = $('#currentSection'); if (!items?.length) return; section.hidden = false;
  $('#currentItems').innerHTML = items.map(item => `<article class="item"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><strong>${esc(item.source)}</strong><span>${esc(fmtDate(item.publishedAt))}</span></div><div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}</div></article>`).join('');
}

async function load() {
  const route = routeInfo();
  if (!route.id) {
    $('#entityStatus').innerHTML = '<h1>Entity not found.</h1><p>This Civic Commons entity route is incomplete.</p><p><a href="/">Return to the civic timeline →</a></p>';
    return;
  }
  try {
    const endpoint = new URL('/.netlify/functions/civic-entity', location.origin); endpoint.searchParams.set('id', route.id);
    const [entityResponse, feedResponse] = await Promise.all([fetch(endpoint,{cache:'no-store'}), fetch('/.netlify/functions/feed',{cache:'no-store'}).catch(() => null)]);
    if (!entityResponse.ok) throw new Error(`Entity HTTP ${entityResponse.status}`);
    const data = await entityResponse.json();
    if (!data.matched) throw new Error(data.reason || 'Entity not found');
    if (route.expectedType && data.entity.type !== route.expectedType) throw new Error(`Entity type mismatch: expected ${route.expectedType}, got ${data.entity.type}`);
    renderHero(data); renderStats(data); renderRelationships(data.relationships, data.entity); renderSources(data.sources); renderReporting(data.reporting);
    if (feedResponse?.ok) { const feed = await feedResponse.json(); renderCurrent(currentMatches(feed,data.entity)); }
  } catch (error) {
    $('#entityStatus').innerHTML = `<h1>Civic entity temporarily unavailable.</h1><p>The reviewed civic-memory service could not load this entity. The rest of Civic Commons is unaffected.</p><p><a href="/">Return to the civic timeline →</a></p>`;
    console.error('Civic entity page failed', error);
  }
}
load();
