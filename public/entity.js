const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(d); };
const labelType = value => String(value || '').replaceAll('_',' ');
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';

function renderHero(data) {
  const entity = data.entity;
  $('#entityStatus').hidden = true;
  const hero = $('#entityHero'); hero.hidden = false;
  hero.innerHTML = `<h1>${esc(entity.name)}</h1><p class="lede">${esc(entity.description || 'A reviewed civic entity in the Southall Stories research archive.')}</p><div class="entity-kicker"><span class="tag">${esc(entity.type)}</span>${(entity.aliases || []).slice(0,5).map(alias => `<span class="tag">also: ${esc(alias)}</span>`).join('')}</div><div class="entity-actions"><a href="#relationshipsSection">Reviewed connections ↓</a><a href="#sourcesSection">Primary evidence ↓</a><a href="#reportingSection">Historical reporting ↓</a></div>`;
}

function renderStats(data) {
  const c = data.counts || {};
  $('#entityStats').innerHTML = `<div class="entity-stat"><strong>${c.reporting || 0}</strong><span>archive posts</span></div><div class="entity-stat"><strong>${c.relationships || 0}</strong><span>reviewed relationships</span></div><div class="entity-stat"><strong>${c.sources || 0}</strong><span>curated sources</span></div>`;
  $('#entityTopics').innerHTML = (data.topics || []).map(topic => `<span class="entity-topic">${esc(topic.name)} · ${topic.count}</span>`).join('') || '<span class="entity-empty">No recurring topics found.</span>';
}

function renderRelationships(items) {
  const section = $('#relationshipsSection');
  if (!items?.length) return;
  section.hidden = false;
  $('#relationships').innerHTML = `<ul class="entity-list">${items.map(rel => `<li><span class="relationship-type">${esc(labelType(rel.type))}</span><h3>${rel.direction === 'outgoing' ? 'Southall Gasworks → ' : ''}${esc(rel.other.name)}${rel.direction === 'incoming' ? ' → Southall Gasworks' : ''}</h3>${rel.note ? `<p class="relationship-note">${esc(rel.note)}</p>` : ''}${rel.evidence?.length ? `<span class="entity-meta">Evidence: ${rel.evidence.map(ev => ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(ev.title)}</a>` : esc(ev.title)).join(' · ')}</span>` : ''}</li>`).join('')}</ul>`;
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
  }).slice(0,8);
}

function renderCurrent(items) {
  const section = $('#currentSection'); if (!items?.length) return; section.hidden = false;
  $('#currentItems').innerHTML = items.map(item => `<article class="item"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><strong>${esc(item.source)}</strong><span>${esc(fmtDate(item.publishedAt))}</span></div><div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}</div></article>`).join('');
}

async function load() {
  const id = document.body.dataset.entityId;
  try {
    const endpoint = new URL('/.netlify/functions/civic-entity', location.origin); endpoint.searchParams.set('id', id);
    const [entityResponse, feedResponse] = await Promise.all([fetch(endpoint,{cache:'no-store'}), fetch('/.netlify/functions/feed',{cache:'no-store'}).catch(() => null)]);
    if (!entityResponse.ok) throw new Error(`Entity HTTP ${entityResponse.status}`);
    const data = await entityResponse.json();
    if (!data.matched) throw new Error(data.reason || 'Entity not found');
    renderHero(data); renderStats(data); renderRelationships(data.relationships); renderSources(data.sources); renderReporting(data.reporting);
    if (feedResponse?.ok) { const feed = await feedResponse.json(); renderCurrent(currentMatches(feed,data.entity)); }
  } catch (error) {
    $('#entityStatus').innerHTML = `<h1>Place page temporarily unavailable.</h1><p>The reviewed civic-memory service could not be loaded. The rest of Civic Commons is unaffected.</p><p><a href="/">Return to the civic timeline →</a></p>`;
    console.error('Civic entity page failed', error);
  }
}
load();
