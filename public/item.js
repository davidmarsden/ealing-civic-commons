import { isFollowing, stableItemKey, toggleFollow } from './follow-store.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const contributionTypeOrder = ['Correction','Evidence / document','Related source','Local information','Comment / context'];
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); };

function routeKey() { const parts = window.location.pathname.split('/').filter(Boolean); return parts[0] === 'items' ? parts.slice(1).join('/') : ''; }
function findItem(data, key) { return (data?.items || []).find(candidate => stableItemKey(candidate.id) === key); }
function threadId(key) { return `civic-item:${key}`; }
function safeHttpUrl(value) { if (!value) return null; try { const url = new URL(value, window.location.origin); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null; } catch { return null; } }

function followButton(type, id, label, text) {
  const active = isFollowing(type, id);
  const activeText = type === 'items' ? '✓ Following this story' : `✓ Following: ${esc(label)}`;
  return `<button class="follow-button${active ? ' active' : ''}" type="button" data-follow-type="${esc(type)}" data-follow-id="${esc(id)}" data-follow-label="${esc(label)}" aria-pressed="${active}">${active ? activeText : `+ Follow ${esc(text)}`}</button>`;
}

function renderFollowControls(item, key) {
  const container = $('#itemFollowControls');
  container.innerHTML = `<div class="follow-primary">${followButton('items', key, item.title, 'this story')}</div><div class="follow-options">${followButton('sources', item.sourceId, item.source, item.source)}${(item.towns || []).map(town => followButton('towns', town, town, town)).join('')}${(item.topics || []).map(topic => followButton('topics', topic, topic, topic)).join('')}</div><p>Follows are stored only in this browser. No account or email address is required.</p>`;
  container.querySelectorAll('[data-follow-type]').forEach(button => button.addEventListener('click', () => { toggleFollow(button.dataset.followType, button.dataset.followId, button.dataset.followLabel); renderFollowControls(item, key); }));
}

function fillContributionFields(item, key) {
  const thread = threadId(key); $('#threadId').textContent = thread; $('#contributionItemId').value = item.id; $('#contributionThreadId').value = thread; $('#contributionPermalink').value = window.location.href; $('#contributionItemTitle').value = item.title; $('#contributionOriginalUrl').value = item.url;
}

function renderItem(item, key) {
  document.title = `${item.title} — Civic Commons`; $('#itemStatus').hidden = true;
  const view = $('#itemView'); view.hidden = false;
  view.innerHTML = `<div class="item-page-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><span>${esc(item.source)}</span><span>${esc(fmtDate(item.publishedAt))}</span></div><h1>${esc(item.title)}</h1>${item.summary ? `<p class="item-page-summary">${esc(item.summary)}</p>` : ''}${item.derived ? `<p class="provenance-note"><strong>Commons-derived extract:</strong> ${esc(item.derivedFrom || 'derived from the source material')}.</p>` : ''}<div class="tags">${(item.towns || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${(item.topics || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><div class="item-page-actions"><a class="primary-source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Read the original source ↗</a><a href="#contribute">Add to this story ↓</a></div><div id="itemFollowControls" class="item-follow-controls" aria-label="Follow this civic information"></div><p class="canonical-note">The original publisher remains the canonical source. This Commons URL exists so local context, evidence, corrections, discussion and follows can attach to a stable civic object.</p>`;
  renderFollowControls(item, key); fillContributionFields(item, key); $('#contribute').hidden = false; $('#discussion').hidden = false; loadCivicMemory(item);
}

function memoryList(items, kind, emptyText = 'Nothing selected yet.') {
  if (!items?.length) return `<p class="memory-meta">${esc(emptyText)}</p>`;
  return `<ul class="memory-list">${items.map(item => `<li><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a><span class="memory-meta">${kind === 'source' ? `${esc(item.publisher || 'Source')}${item.date ? ` · ${esc(fmtDate(item.date))}` : ''}` : esc(fmtDate(item.date))}</span></li>`).join('')}</ul>`;
}

function renderCivicMemory(memory) {
  if (!memory?.matched) return;
  const section = $('#civicMemory'); const content = $('#civicMemoryContent');
  const entityTags = (memory.entities || []).map(entity => `<span class="memory-tag">${esc(entity.name)} <small>${esc(entity.type)}</small></span>`).join('');
  const topicTags = (memory.topics || []).map(topic => `<span class="memory-tag">${esc(topic.name)}</span>`).join('');
  const primaryEvidence = memoryList(memory.primaryEvidence, 'source', 'No directly cited primary evidence was identified for this story.');
  const relatedSources = memoryList(memory.relatedSourceMaterial, 'source', 'No additional related source material passed the relevance threshold for this story.');
  content.innerHTML = `<div class="civic-memory-heading"><div><p class="eyebrow">Related civic memory</p><h2 id="civicMemoryTitle">What connects to this story?</h2><p>Historical context drawn from Southall Stories reporting and reviewed source material. It adds connections around the story without replacing the original article.</p></div></div><div class="memory-grid"><section class="memory-panel"><h3>People, organisations, places & topics</h3><div class="memory-tags">${entityTags}${topicTags}</div></section><section class="memory-panel"><h3>Earlier reporting</h3>${memoryList(memory.earlierReporting, 'post', 'No earlier article passed the stronger relevance threshold for this story.')}</section><section class="memory-panel"><h3>Primary evidence</h3><p class="memory-meta">Sources directly cited by this story or used as evidence for a reviewed relationship between entities in it.</p>${primaryEvidence}</section><section class="memory-panel"><h3>Related source material</h3><p class="memory-meta">Additional authoritative records connected through the story’s more specific people, places or organisations.</p>${relatedSources}</section></div><p class="memory-provenance">Historical context from the Southall Stories research archive. Connections between people, places and topics are generated from the archive; important relationships and source records are checked before publication. The original publisher remains canonical.</p>`;
  section.hidden = false;
}

async function loadCivicMemory(item) {
  const section = $('#civicMemory'); section.hidden = true;
  if (item.sourceId !== 'southall-stories' || !item.url) return;
  try { const url = new URL('/.netlify/functions/civic-memory', location.origin); url.searchParams.set('url', item.url); const response = await fetch(url, { cache: 'no-store' }); if (!response.ok) return; renderCivicMemory(await response.json()); }
  catch (error) { console.warn('Related civic memory unavailable', error); }
}

function contributionCard(contribution) { const link = safeHttpUrl(contribution.relatedUrl); const contributor = contribution.displayName || 'Community contributor'; const provenance = contribution.provenance || 'Submitted to Civic Commons and reviewed before publication.'; return `<article class="contribution-card" id="contribution-${esc(contribution.id)}"><div class="contribution-card-meta"><strong>${esc(contributor)}</strong><span>${esc(fmtDate(contribution.publishedAt || contribution.submittedAt))}</span><span class="moderation-status">Published after review</span></div><p class="contribution-body">${esc(contribution.body)}</p>${link ? `<p class="contribution-link"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Open related source ↗</a></p>` : ''}<p class="contribution-provenance">${esc(provenance)}</p></article>`; }

function renderContributions(contributions, key) {
  const list = $('#contributionList'); const count = $('#contributionCount'); const expectedThread = threadId(key);
  const published = (contributions || []).filter(entry => entry && entry.status === 'published' && entry.threadId === expectedThread && entry.body).sort((a,b) => Date.parse(a.publishedAt || a.submittedAt || 0) - Date.parse(b.publishedAt || b.submittedAt || 0));
  count.textContent = `${published.length} published`;
  if (!published.length) { list.innerHTML = '<div class="contribution-empty"><strong>No approved contributions yet.</strong><span>Have evidence, a correction or useful local context? Add it above for moderation.</span></div>'; return; }
  const groups = new Map(); published.forEach(entry => { const type = contributionTypeOrder.includes(entry.type) ? entry.type : 'Comment / context'; if (!groups.has(type)) groups.set(type, []); groups.get(type).push(entry); });
  list.innerHTML = contributionTypeOrder.filter(type => groups.has(type)).map(type => `<section class="contribution-group"><div class="contribution-group-heading"><h3>${esc(type)}</h3><span>${groups.get(type).length}</span></div><div class="contribution-group-items">${groups.get(type).map(contributionCard).join('')}</div></section>`).join('');
}

async function loadApprovedContributions(key) { try { const response = await fetch('/data/contributions.json', { cache:'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); renderContributions(data.contributions, key); } catch (error) { $('#contributionCount').textContent=''; $('#contributionList').innerHTML='<div class="contribution-empty"><strong>Approved contributions are temporarily unavailable.</strong><span>The item and submission form are still available.</span></div>'; console.error('Approved contributions load failed', error); } }
function renderMissing(key) { $('#itemStatus').innerHTML = `<h1>This civic item has not been archived yet.</h1><p>The permalink and thread identity are stable. New live items are now copied into the persistent Civic Commons item store every 15 minutes, so this message should normally only appear for links created before the archive existed or before the next archive run.</p><p><strong>Item key:</strong> <code>${esc(key)}</code></p><p><a href="/">Return to the current civic timeline →</a></p>`; }
function renderUnavailable(error) { $('#itemStatus').innerHTML='<h1>Item temporarily unavailable.</h1><p>The persistent Civic Commons item archive could not be reached for this permalink. Please try again shortly.</p><p><a href="/">Return to the timeline →</a></p>'; console.error('Item archive lookup failed', error); }

async function loadArchivedItem(key) {
  const url = new URL('/.netlify/functions/civic-item', location.origin);
  url.searchParams.set('key', key);
  let response;
  try {
    response = await fetch(url, { cache: 'no-store' });
  } catch (error) {
    throw new Error(`Archive request failed: ${error.message || error}`);
  }
  if (response.status === 404) return { status: 'missing', item: null };
  if (!response.ok) throw new Error(`Archive lookup returned HTTP ${response.status}`);
  const data = await response.json();
  return data?.item ? { status: 'found', item: data.item } : { status: 'missing', item: null };
}

async function load() {
  const key = routeKey(); if (!key) { renderMissing('missing'); return; }
  const contributionsPromise = loadApprovedContributions(key);
  const archivedPromise = loadArchivedItem(key);
  try {
    const response = await fetch('/.netlify/functions/feed', { cache:'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const liveItem = findItem(data,key);
    if (liveItem) renderItem(liveItem,key);
    else {
      try {
        const archived = await archivedPromise;
        if (archived.status === 'found') renderItem(archived.item,key);
        else renderMissing(key);
      } catch (archiveError) {
        renderUnavailable(archiveError);
      }
    }
  }
  catch (error) {
    try {
      const archived = await archivedPromise;
      if (archived.status === 'found') renderItem(archived.item,key);
      else {
        const demoItem = findItem(window.CIVIC_COMMONS_DEMO,key);
        if (demoItem) renderItem(demoItem,key);
        else renderMissing(key);
      }
    } catch (archiveError) {
      const demoItem = findItem(window.CIVIC_COMMONS_DEMO,key);
      if (demoItem) renderItem(demoItem,key);
      else renderUnavailable(archiveError);
      console.error('Live item load also failed', error);
    }
  }
  await contributionsPromise;
}
window.addEventListener('storage', event => { if (event.key === 'civic-commons:follows:v1') location.reload(); });
load();
