const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(d); };
const relationshipLabels = new Map([
  ['leader_of','leader of'],
  ['deputy_leader_of','deputy leader of'],
  ['cabinet_member_of','cabinet member of'],
  ['developer_of','developer of'],
  ['founder_of','founder of'],
  ['employed_by','employed by'],
  ['chair_of','chair of'],
  ['member_of','member of'],
  ['facilitated_by','facilitated by'],
  ['located_in','located in'],
  ['regulates_remediation_at','regulates remediation at'],
  ['health_risk_adviser_for','health-risk adviser for'],
  ['officer_of','officer of'],
  ['panel_of','panel of'],
  ['scrutinised','scrutinised'],
  ['appeared_before','appeared before'],
  ['part_of','part of'],
  ['mipim_trip_sponsored_in_part_by','MIPIM trip sponsored in part by'],
  ['received_mipim_sponsorship_from','received MIPIM sponsorship from']
]);
const labelType = value => relationshipLabels.get(value) || String(value || '').replaceAll('_',' ');
const providerLabel = value => value === 'southall-zettel' ? 'Southall Stories research archive' : value === 'civic-commons' ? 'Civic Commons' : value || 'reviewed provider';
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const routeType = new Map([['people','person'],['organisations','organisation'],['places','place']]);
const typeLabel = new Map([['person','person'],['organisation','organisation'],['place','place']]);

function routeInfo() {
  if (document.body.dataset.entityId) {
    const id = document.body.dataset.entityId;
    const type = document.body.dataset.entityType || null;
    const slug = id.replace(/^entity:/,'');
    const segment = type === 'person' ? 'people' : type === 'organisation' ? 'organisations' : type === 'place' ? 'places' : 'places';
    return { route: `${segment}/${slug}`, expectedType: type, slug, segment };
  }
  const parts = location.pathname.split('/').filter(Boolean);
  const segment = parts[0];
  const slug = parts[1]?.replace(/\.html$/,'');
  return { route: segment && slug ? `${segment}/${slug}` : null, expectedType: routeType.get(segment) || null, slug, segment };
}

function entityLink(entity, label = entity?.name) {
  if (entity?.commonsRoute) return `<a class="entity-inline-link" href="/${esc(entity.commonsRoute)}">${esc(label)}</a>`;
  return esc(label);
}
function topicLink(topic) {
  const slug = String(topic?.id || '').replace(/^topic:/,'');
  return slug ? `<a class="entity-topic" href="/topics/${esc(slug)}">${esc(topic.name)} · ${topic.count}</a>` : `<span class="entity-topic">${esc(topic?.name)} · ${topic.count}</span>`;
}

function canonicalUrl(value) {
  try { const url = new URL(value, location.origin); url.hash = ''; if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/,''); return url.toString(); }
  catch { return String(value || '').trim(); }
}

function mergeReporting(reviewed = [], archived = []) {
  const merged = [];
  const seen = new Set();
  const add = item => {
    const key = canonicalUrl(item.url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  };
  reviewed.forEach(post => add({ ...post, source: post.source || 'Southall Stories', date: post.date || post.publishedAt || null, reviewedMatch: true }));
  archived.forEach(record => {
    const item = record?.item;
    if (!item?.url) return;
    add({ title: item.title, url: item.url, summary: item.summary, date: item.publishedAt || record.archivedAt, source: item.source || 'Archived publisher', archivedMatch: true });
  });
  return merged.sort((a,b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
}

async function archivedReporting(terms = [], topics = []) {
  const endpoint = new URL('/.netlify/functions/historical-reporting', location.origin);
  [...new Set(terms.filter(term => String(term || '').trim().length >= 3))].slice(0,20).forEach(term => endpoint.searchParams.append('term', term));
  [...new Set(topics.filter(Boolean))].slice(0,20).forEach(topic => endpoint.searchParams.append('topic', topic));
  endpoint.searchParams.set('limit','100');
  const response = await fetch(endpoint,{cache:'no-store'});
  if (!response.ok) throw new Error(`Historical reporting HTTP ${response.status}`);
  return (await response.json()).records || [];
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
  const website = entity.website?.url ? `<a class="tag" href="${esc(entity.website.url)}" target="_blank" rel="noopener noreferrer">${esc(entity.website.label || 'Website')} ↗</a>` : '';
  hero.innerHTML = `<h1>${esc(entity.name)}</h1><p class="lede">${esc(entity.description || fallback)}</p><div class="entity-kicker"><span class="tag">${esc(entity.type)}</span>${(entity.aliases || []).slice(0,5).map(alias => `<span class="tag">also: ${esc(alias)}</span>`).join('')}${website}</div><div class="entity-actions"><a href="#commonsAssertionsSection">Current civic facts ↓</a><a href="#relationshipsSection">Reviewed connections ↓</a><a href="#sourcesSection">Primary evidence ↓</a><a href="#reportingSection">Historical reporting ↓</a><a href="#currentSection">Current Commons ↓</a></div>`;
}

function renderStats(data, historicalCount = null) {
  const c = data.counts || {};
  const reporting = historicalCount == null ? (c.reporting || 0) : historicalCount;
  $('#entityStats').innerHTML = `<div class="entity-stat"><strong>${reporting}</strong><span>historical reports</span></div><div class="entity-stat"><strong>${c.relationships || 0}</strong><span>reviewed relationships</span></div><div class="entity-stat"><strong>${c.sources || 0}</strong><span>curated sources</span></div>`;
  $('#entityTopics').innerHTML = (data.topics || []).map(topicLink).join('') || '<span class="entity-empty">No recurring topics found.</span>';
}

function renderProviders(items) {
  const root = $('#entityProviders');
  if (!root) return;
  root.innerHTML = (items || []).map(provider => `<div class="entity-provider"><strong>${provider.url ? `<a href="${esc(provider.url)}" target="_blank" rel="noopener noreferrer">${esc(provider.label || provider.name)}</a>` : esc(provider.label || provider.name)}</strong><span>${esc(provider.role || provider.bindingRole || 'Data provider')}</span></div>`).join('') || '<span class="entity-empty">No provider metadata available.</span>';
}

function renderCommonsAssertions(data, entity) {
  const items = data?.assertions || [];
  const section = $('#commonsAssertionsSection');
  if (!section || !items.length) return;
  section.hidden = false;
  const current = { ...entity, commonsRoute: window.__civicEntityRoute || null };
  $('#commonsAssertions').innerHTML = `<ul class="entity-list">${items.map(assertion => {
    const from = assertion.direction === 'outgoing' ? entityLink(current) : entityLink(assertion.other);
    const to = assertion.direction === 'outgoing' ? entityLink(assertion.other) : entityLink(current);
    const reviewed = assertion.reviewedBy ? `${assertion.reviewedBy}${assertion.reviewedAt ? ` · reviewed ${fmtDate(assertion.reviewedAt)}` : ''}` : 'Civic Commons';
    return `<li><span class="relationship-type">${esc(labelType(assertion.type))}</span><h3>${from} → ${to}</h3>${assertion.note ? `<p class="relationship-note">${esc(assertion.note)}</p>` : ''}${assertion.validFrom || assertion.validTo ? `<span class="entity-meta">Period: ${esc(assertion.validFrom || 'unknown')} → ${esc(assertion.validTo || 'present')}</span>` : ''}${assertion.evidence?.length ? `<span class="entity-meta">Evidence: ${assertion.evidence.map(ev => ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(ev.title)}</a>` : esc(ev.title)).join(' · ')}</span>` : ''}<span class="entity-meta">Reviewed by ${esc(reviewed)}</span></li>`;
  }).join('')}</ul>`;
}

function renderRelationships(items, entity) {
  const section = $('#relationshipsSection');
  if (!items?.length) return;
  section.hidden = false;
  const current = dataEntity => ({ ...dataEntity, commonsRoute: window.__civicEntityRoute || null });
  $('#relationships').innerHTML = `<ul class="entity-list">${items.map(rel => {
    const from = rel.direction === 'outgoing' ? entityLink(current(entity)) : entityLink(rel.other);
    const to = rel.direction === 'outgoing' ? entityLink(rel.other) : entityLink(current(entity));
    return `<li><span class="relationship-type">${esc(labelType(rel.type))}</span><h3>${from} → ${to}</h3>${rel.note ? `<p class="relationship-note">${esc(rel.note)}</p>` : ''}${rel.validFrom || rel.validTo ? `<span class="entity-meta">Period: ${esc(rel.validFrom || 'unknown')} → ${esc(rel.validTo || 'present')}</span>` : ''}${rel.evidence?.length ? `<span class="entity-meta">Evidence: ${rel.evidence.map(ev => ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(ev.title)}</a>` : esc(ev.title)).join(' · ')}</span>` : ''}<span class="entity-meta">Reviewed source: ${esc(providerLabel(rel.provider))}</span></li>`;
  }).join('')}</ul>`;
}

function renderSources(items) {
  const section = $('#sourcesSection'); if (!items?.length) return; section.hidden = false;
  $('#sources').innerHTML = `<ul class="entity-list">${items.map(source => `<li><h3>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>` : esc(source.title)}</h3><span class="entity-meta">${esc(source.publisher || 'Source')} · ${esc(labelType(source.sourceType))}${source.date ? ` · ${esc(fmtDate(source.date))}` : ''}</span>${source.archiveUrls?.length ? `<span class="entity-meta">Archived copy available</span>` : ''}</li>`).join('')}</ul>`;
}

function renderReporting(items) {
  const section = $('#reportingSection'); if (!items?.length) return; section.hidden = false;
  $('#reporting').innerHTML = `<ul class="entity-list">${items.map(post => `<li><h3><a href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">${esc(post.title)}</a></h3>${post.summary ? `<p>${esc(post.summary)}</p>` : ''}<span class="entity-meta">${esc(post.source || 'Publisher')} · ${esc(fmtDate(post.date))}${post.reviewedMatch ? ' · reviewed match' : ' · Civic Archive match'}</span></li>`).join('')}</ul>`;
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
  if (!route.route) {
    $('#entityStatus').innerHTML = '<h1>Entity not found.</h1><p>This Civic Commons entity route is incomplete.</p><p><a href="/explore.html">Explore the civic graph →</a></p>';
    return;
  }
  try {
    const endpoint = new URL('/.netlify/functions/civic-entity', location.origin); endpoint.searchParams.set('route', route.route);
    const entityResponse = await fetch(endpoint,{cache:'no-store'});
    if (!entityResponse.ok) throw new Error(`Entity HTTP ${entityResponse.status}`);
    const data = await entityResponse.json();
    if (!data.matched) throw new Error(data.reason || 'Entity not found');
    if (route.expectedType && data.entity.type !== route.expectedType) throw new Error(`Entity type mismatch: expected ${route.expectedType}, got ${data.entity.type}`);
    window.__civicEntityRoute = data.civicEntity?.route || route.route;
    renderHero(data); renderStats(data); renderProviders(data.providers); renderRelationships(data.relationships, data.entity); renderSources(data.sources);

    const assertionsEndpoint = new URL('/.netlify/functions/civic-assertions', location.origin); assertionsEndpoint.searchParams.set('route', route.route);
    const [archiveResult, assertionsResponse, feedResponse] = await Promise.all([
      archivedReporting([data.entity.name, ...(data.entity.aliases || [])]).catch(() => []),
      fetch(assertionsEndpoint,{cache:'no-store'}).catch(() => null),
      fetch('/.netlify/functions/feed',{cache:'no-store'}).catch(() => null)
    ]);
    const historical = mergeReporting(data.reporting, archiveResult);
    renderReporting(historical); renderStats(data, historical.length);
    if (assertionsResponse?.ok) { const assertions = await assertionsResponse.json(); if (assertions.matched) renderCommonsAssertions(assertions, data.entity); }
    if (feedResponse?.ok) { const feed = await feedResponse.json(); renderCurrent(currentMatches(feed,data.entity)); }
  } catch (error) {
    $('#entityStatus').innerHTML = `<h1>Civic entity temporarily unavailable.</h1><p>The civic entity service could not load this page. The rest of Civic Commons is unaffected.</p><p><a href="/explore.html">Explore the civic graph →</a></p>`;
    console.error('Civic entity page failed', error);
  }
}
load();
