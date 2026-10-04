const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => { if (!iso) return 'Date unavailable'; const date = new Date(iso); return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric'}).format(date); };
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const canonical = value => { try { const url = new URL(value, location.origin); url.hash=''; if(url.pathname!=='/')url.pathname=url.pathname.replace(/\/+$/,''); return url.toString(); } catch { return String(value||'').trim(); } };

function placeRoute() {
  const parts=location.pathname.split('/').filter(Boolean);
  return parts[0]==='places'&&parts[1] ? `places/${parts[1].replace(/\.html$/,'')}` : null;
}
function existingUrls(root) { return new Set([...root.querySelectorAll('a[href]')].map(link=>canonical(link.href))); }
function linked(item, route) { return (item?.placeLinks||[]).some(link=>link?.route===route); }
function currentCard(item, route) {
  const link=(item.placeLinks||[]).find(candidate=>candidate.route===route);
  const note=link ? `<p class="entity-current-note">Linked to this place${link.provenance==='inferred-place-candidate'?' by a narrow contextual discovery rule':''}.</p>` : '';
  return `<article class="item" data-place-linked="true"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass||'Civic record')}</span><strong>${esc(item.source||'Publisher')}</strong><span>${esc(fmtDate(item.publishedAt))}</span></div><div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary?`<p class="item-summary">${esc(item.summary)}</p>`:''}${note}</div></article>`;
}
function reportingCard(record) {
  const item=record.item;
  return `<li data-place-linked="true"><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary?`<p>${esc(item.summary)}</p>`:''}<span class="entity-meta">${esc(item.source||'Publisher')} · ${esc(fmtDate(item.publishedAt||record.archivedAt))} · place-linked Civic Archive match</span></li>`;
}
async function waitForEntity() {
  for(let i=0;i<40;i+=1){ if(document.querySelector('#entityHero:not([hidden])')) return true; await new Promise(resolve=>setTimeout(resolve,100)); }
  return false;
}

function reconcileCurrent(feed, route) {
  const root=document.querySelector('#currentItems');
  const section=document.querySelector('#currentSection');
  if(!feed||!root||!section) return false;
  const seen=existingUrls(root);
  const additions=(feed.items||[])
    .filter(item=>linked(item,route)&&item.url&&!seen.has(canonical(item.url)))
    .sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0));
  if(additions.length) root.insertAdjacentHTML('beforeend',additions.map(item=>currentCard(item,route)).join(''));
  if(root.children.length) section.hidden=false;
  return additions.length>0;
}

async function enhance() {
  const route=placeRoute();
  if(!route||!await waitForEntity()) return;
  const [feedResult,archiveResult]=await Promise.allSettled([
    fetch('/.netlify/functions/combined-feed',{cache:'no-store'}).then(response=>response.ok?response.json():null),
    fetch(`/.netlify/functions/historical-reporting?place=${encodeURIComponent(route)}&limit=100`,{cache:'no-store'}).then(response=>response.ok?response.json():null)
  ]);
  const feed=feedResult.status==='fulfilled'?feedResult.value:null;

  // The base entity renderer can finish after this enhancer. Reconcile a few times
  // during startup instead of observing our own DOM writes: a MutationObserver here
  // caused a self-triggering microtask loop and could freeze the page.
  reconcileCurrent(feed,route);
  if(feed){
    [250,750,1500,3000].forEach(delay=>setTimeout(()=>reconcileCurrent(feed,route),delay));
  }

  const archive=archiveResult.status==='fulfilled'?archiveResult.value:null;
  const reportingRoot=document.querySelector('#reporting');
  const reportingSection=document.querySelector('#reportingSection');
  if(archive&&reportingRoot&&reportingSection){
    const seen=existingUrls(reportingRoot);
    const additions=(archive.records||[]).filter(record=>record?.item?.url&&!seen.has(canonical(record.item.url)));
    if(additions.length){
      let list=reportingRoot.querySelector('ul.entity-list');
      if(!list){ reportingRoot.innerHTML='<ul class="entity-list"></ul>'; list=reportingRoot.querySelector('ul.entity-list'); }
      list.insertAdjacentHTML('beforeend',additions.map(reportingCard).join(''));
      reportingSection.hidden=false;
    }
  }
}
enhance().catch(error=>console.warn('Place-linked civic records unavailable',error));
