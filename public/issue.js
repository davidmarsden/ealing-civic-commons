const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(d); };
const labelType = value => String(value || '').replaceAll('_',' ');
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';

function routeInfo() {
  const parts = location.pathname.split('/').filter(Boolean);
  const slug = parts[0] === 'issues' ? parts[1]?.replace(/\.html$/,'') : null;
  return { route: slug ? `issues/${slug}` : null, slug };
}
function entityLink(entity) {
  return entity?.commonsRoute ? `<a class="entity-inline-link" href="/${esc(entity.commonsRoute)}">${esc(entity.name)}</a>` : esc(entity?.name || entity?.id);
}
function topicLink(topic) {
  const slug = String(topic?.id || '').replace(/^topic:/,'');
  return slug ? `<a class="entity-topic" href="/topics/${esc(slug)}">${esc(topic.name)}</a>` : `<span class="entity-topic">${esc(topic?.name)}</span>`;
}
function canonicalUrl(value) { try { const url=new URL(value,location.origin); url.hash=''; if(url.pathname!=='/')url.pathname=url.pathname.replace(/\/+$/,''); return url.toString(); } catch { return String(value||'').trim(); } }
function mergeReporting(reviewed=[],archived=[]) { const out=[],seen=new Set(); const add=item=>{const key=canonicalUrl(item.url); if(!key||seen.has(key))return; seen.add(key); out.push(item);}; reviewed.forEach(post=>add({...post,source:post.source||'Southall Stories',date:post.date||post.publishedAt||null,reviewedMatch:true})); archived.forEach(record=>{const item=record?.item;if(item?.url)add({title:item.title,url:item.url,summary:item.summary,date:item.publishedAt||record.archivedAt,source:item.source||'Archived publisher',archivedMatch:true});}); return out.sort((a,b)=>(Date.parse(b.date||'')||0)-(Date.parse(a.date||'')||0)); }
async function archivedReporting(terms=[]) { const endpoint=new URL('/.netlify/functions/historical-reporting',location.origin); [...new Set(terms.filter(term=>String(term||'').trim().length>=3))].slice(0,20).forEach(term=>endpoint.searchParams.append('term',term)); endpoint.searchParams.set('limit','100'); const response=await fetch(endpoint,{cache:'no-store'}); if(!response.ok)throw new Error(`Historical reporting HTTP ${response.status}`); return (await response.json()).records||[]; }
function renderHero(data) {
  document.title = `${data.issue.name} — Civic Commons`;
  $('#issueStatus').hidden = true;
  const hero = $('#issueHero'); hero.hidden = false;
  hero.innerHTML = `<div class="issue-status-row"><span class="issue-status-pill">${esc(data.issue.status)}</span></div><h1>${esc(data.issue.name)}</h1><p class="lede">${esc(data.issue.description)}</p><div class="entity-actions"><a href="#actorsSection">Who & what ↓</a><a href="#relationshipsSection">Reviewed connections ↓</a><a href="#sourcesSection">Evidence ↓</a><a href="#currentSection">Current Commons ↓</a><a href="#reportingSection">Historical reporting ↓</a></div>`;
}
function renderStats(data,historicalCount=null) {
  const c = data.counts || {};
  const reporting = historicalCount == null ? (c.reporting || 0) : historicalCount;
  const stats = [[c.entities || 0,'key entities'], [c.relationships || 0,'reviewed relationships'], [c.sources || 0,'curated sources'], [reporting,'historical reports']];
  $('#issueStats').innerHTML = stats.map(([n,label]) => `<div class="entity-stat"><strong>${n}</strong><span>${label}</span></div>`).join('');
  $('#issueTopics').innerHTML = (data.topics || []).map(topicLink).join('') || '<span class="entity-empty">No reviewed topics found.</span>';
}
function renderProviders(items) {
  $('#issueProviders').innerHTML = (items || []).map(provider => `<div class="entity-provider"><strong>${provider.url ? `<a href="${esc(provider.url)}" target="_blank" rel="noopener noreferrer">${esc(provider.label || provider.name)}</a>` : esc(provider.label || provider.name)}</strong><span>${esc(provider.role || 'Data provider')}</span></div>`).join('');
}
function renderActors(items) {
  if (!items?.length) return;
  $('#actorsSection').hidden = false;
  $('#issueActors').innerHTML = `<div class="issue-actor-grid">${items.map(entity => `<a class="issue-actor" href="/${esc(entity.commonsRoute || '')}"><span class="relationship-type">${esc(entity.type)}</span><strong>${esc(entity.name)}</strong>${entity.description ? `<span>${esc(entity.description)}</span>` : ''}</a>`).join('')}</div>`;
}
function renderRelationships(items) {
  if (!items?.length) return;
  $('#relationshipsSection').hidden = false;
  $('#issueRelationships').innerHTML = `<ul class="entity-list">${items.slice(0,20).map(rel => `<li><span class="relationship-type">${esc(labelType(rel.type))}</span><h3>${entityLink(rel.from)} → ${entityLink(rel.to)}</h3>${rel.note ? `<p class="relationship-note">${esc(rel.note)}</p>` : ''}${rel.evidence?.length ? `<span class="entity-meta">Evidence: ${rel.evidence.map(ev => ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(ev.title)}</a>` : esc(ev.title)).join(' · ')}</span>` : ''}</li>`).join('')}</ul>`;
}
function renderSources(items) {
  if (!items?.length) return;
  $('#sourcesSection').hidden = false;
  $('#issueSources').innerHTML = `<ul class="entity-list">${items.slice(0,24).map(source => `<li><h3>${source.url ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>` : esc(source.title)}</h3><span class="entity-meta">${esc(source.publisher || 'Source')} · ${esc(labelType(source.sourceType))}${source.date ? ` · ${esc(fmtDate(source.date))}` : ''}</span>${source.archiveUrls?.length ? `<span class="entity-meta">Archived copy available</span>` : ''}</li>`).join('')}</ul>`;
}
function renderReporting(items) {
  if (!items?.length) return;
  $('#reportingSection').hidden = false;
  const reviewed = items.filter(post => post.reviewedMatch);
  const archived = items.filter(post => !post.reviewedMatch).slice(0,60);
  const visible = [...reviewed, ...archived].sort((a,b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
  $('#issueReporting').innerHTML = `<ul class="entity-list">${visible.map(post => `<li><h3><a href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">${esc(post.title)}</a></h3>${post.summary ? `<p>${esc(post.summary)}</p>` : ''}<span class="entity-meta">${esc(post.source || 'Publisher')} · ${esc(fmtDate(post.date))}${post.reviewedMatch ? ` · reviewed match${Number.isFinite(post.entityMatches) ? ` · ${post.entityMatches} entity match${post.entityMatches === 1 ? '' : 'es'}` : ''}${Number.isFinite(post.topicMatches) ? ` · ${post.topicMatches} topic match${post.topicMatches === 1 ? '' : 'es'}` : ''}` : ' · Civic Archive match'}</span></li>`).join('')}</ul>`;
}
function currentMatches(feed, issue) {
  const terms = [issue.name, ...(issue.aliases || [])].filter(Boolean).sort((a,b)=>b.length-a.length);
  return (feed?.items || []).filter(item => {
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    return terms.some(term => term.length >= 5 && text.includes(term.toLowerCase()));
  }).slice(0,16);
}
function renderCurrent(items) {
  if (!items?.length) return;
  $('#currentSection').hidden = false;
  $('#currentItems').innerHTML = items.map(item => `<article class="item"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><strong>${esc(item.source)}</strong><span>${esc(fmtDate(item.publishedAt))}</span></div><div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}</div></article>`).join('');
}
async function load() {
  const route = routeInfo();
  if (!route.route) { $('#issueStatus').innerHTML = '<h1>Issue not found.</h1><p><a href="/explore.html">Explore the civic graph →</a></p>'; return; }
  try {
    const endpoint = new URL('/.netlify/functions/civic-issue', location.origin); endpoint.searchParams.set('route', route.route);
    const issueResponse = await fetch(endpoint,{cache:'no-store'});
    if (!issueResponse.ok) throw new Error(`Issue HTTP ${issueResponse.status}`);
    const data = await issueResponse.json(); if (!data.matched) throw new Error(data.reason || 'Issue not found');
    renderHero(data); renderStats(data); renderProviders(data.providers); renderActors(data.entities); renderRelationships(data.relationships); renderSources(data.sources);
    const [archiveResult,feedResponse] = await Promise.all([
      archivedReporting([data.issue.name,...(data.issue.aliases||[])]).catch(()=>[]),
      fetch('/.netlify/functions/feed',{cache:'no-store'}).catch(()=>null)
    ]);
    const historical=mergeReporting(data.reporting,archiveResult); renderReporting(historical); renderStats(data,historical.length);
    if (feedResponse?.ok) { const feed = await feedResponse.json(); renderCurrent(currentMatches(feed,data.issue)); }
  } catch (error) {
    $('#issueStatus').innerHTML = '<h1>Civic issue temporarily unavailable.</h1><p>The issue graph could not be loaded. The rest of Civic Commons is unaffected.</p><p><a href="/explore.html">Explore the civic graph →</a></p>';
    console.error('Civic issue page failed', error);
  }
}
load();
