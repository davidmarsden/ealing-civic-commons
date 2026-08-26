import { isFollowing, stableItemKey, toggleFollow } from './follow-store.js';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const contributionTypeOrder = ['Correction','Evidence / document','Related source','Local information','Comment / context'];
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const d = new Date(iso); return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); };

function routeKey() { const parts = window.location.pathname.split('/').filter(Boolean); return parts[0] === 'items' ? parts.slice(1).join('/') : ''; }
function findItem(data, key) { return (data?.items || []).find(candidate => stableItemKey(candidate.id) === key); }
function threadId(key) { return `civic-item:${key}`; }
function safeHttpUrl(value) { if (!value) return null; try { const url = new URL(value, window.location.origin); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null; } catch { return null; } }

function followButton(type, id, label, text) {
  const active = isFollowing(type, id);
  return `<button class="follow-button${active ? ' active' : ''}" type="button" data-follow-type="${esc(type)}" data-follow-id="${esc(id)}" data-follow-label="${esc(label)}" aria-pressed="${active}">${active ? '✓ Following' : `+ Follow ${esc(text)}`}</button>`;
}

function renderFollowControls(item, key) {
  const container = $('#itemFollowControls');
  container.innerHTML = `
    <div class="follow-primary">${followButton('items', key, item.title, 'this story')}</div>
    <div class="follow-options">
      ${followButton('sources', item.sourceId, item.source, item.source)}
      ${(item.towns || []).map(town => followButton('towns', town, town, town)).join('')}
      ${(item.topics || []).map(topic => followButton('topics', topic, topic, topic)).join('')}
    </div>
    <p>Follows are stored only in this browser. No account or email address is required.</p>
  `;
  container.querySelectorAll('[data-follow-type]').forEach(button => button.addEventListener('click', () => {
    toggleFollow(button.dataset.followType, button.dataset.followId, button.dataset.followLabel);
    renderFollowControls(item, key);
  }));
}

function fillContributionFields(item, key) {
  const thread = threadId(key);
  $('#threadId').textContent = thread;
  $('#contributionItemId').value = item.id;
  $('#contributionThreadId').value = thread;
  $('#contributionPermalink').value = window.location.href;
  $('#contributionItemTitle').value = item.title;
  $('#contributionOriginalUrl').value = item.url;
}

function renderItem(item, key) {
  document.title = `${item.title} — Civic Commons`;
  $('#itemStatus').hidden = true;
  const view = $('#itemView'); view.hidden = false;
  view.innerHTML = `<div class="item-page-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><span>${esc(item.source)}</span><span>${esc(fmtDate(item.publishedAt))}</span></div><h1>${esc(item.title)}</h1>${item.summary ? `<p class="item-page-summary">${esc(item.summary)}</p>` : ''}${item.derived ? `<p class="provenance-note"><strong>Commons-derived extract:</strong> ${esc(item.derivedFrom || 'derived from the source material')}.</p>` : ''}<div class="tags">${(item.towns || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${(item.topics || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><div class="item-page-actions"><a class="primary-source-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Read the original source ↗</a><a href="#contribute">Add to this story ↓</a></div><div id="itemFollowControls" class="item-follow-controls" aria-label="Follow this civic information"></div><p class="canonical-note">The original publisher remains the canonical source. This Commons URL exists so local context, evidence, corrections, discussion and follows can attach to a stable civic object.</p>`;
  renderFollowControls(item, key);
  fillContributionFields(item, key);
  $('#contribute').hidden = false; $('#discussion').hidden = false;
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
function renderMissing(key) { $('#itemStatus').innerHTML = `<h1>This item is not in the current live window.</h1><p>The permalink and thread identity are stable, but the prototype does not yet persist every ingested item in a civic data store.</p><p><strong>Item key:</strong> <code>${esc(key)}</code></p><p><a href="/">Return to the current civic timeline →</a></p>`; }

async function load() {
  const key = routeKey(); if (!key) { renderMissing('missing'); return; }
  const contributionsPromise = loadApprovedContributions(key);
  try { const response = await fetch('/.netlify/functions/feed', { cache:'no-store' }); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); const item = findItem(data,key); if (!item) { renderMissing(key); return; } renderItem(item,key); }
  catch (error) { const demoItem = findItem(window.CIVIC_COMMONS_DEMO,key); if (demoItem) { renderItem(demoItem,key); await contributionsPromise; return; } $('#itemStatus').innerHTML='<h1>Item temporarily unavailable.</h1><p>The live civic feed could not be loaded and this permalink is not present in the bundled prototype dataset.</p><p><a href="/">Return to the timeline →</a></p>'; console.error('Item load failed',error); }
  await contributionsPromise;
}
window.addEventListener('storage', event => { if (event.key === 'civic-commons:follows:v1') location.reload(); });
load();
