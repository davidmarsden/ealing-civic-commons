import { createHash } from 'node:crypto';

const sources = [
  {
    id: 'hanwell-community-forum',
    name: 'Hanwell Community Forum',
    url: 'https://hanwellcommunityforum.org.uk/',
    homepage: 'https://hanwellcommunityforum.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Hanwell'],
    topics: ['Community', 'Council & democracy'],
    mode: 'living'
  },
  {
    id: 'southall-community-alliance',
    name: 'Southall Community Alliance',
    url: 'https://southallcommunityalliance.com/',
    homepage: 'https://southallcommunityalliance.com/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall'],
    topics: ['Community'],
    mode: 'dated-links',
    startMarker: 'Our News Page',
    endMarker: 'SCA Resource Centre'
  },
  {
    id: 'norwood-green-residents',
    name: 'Norwood Green Residents’ Association',
    url: 'https://norwoodgreenresidents.org/',
    homepage: 'https://norwoodgreenresidents.org/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall'],
    topics: ['Community', 'Planning & development'],
    mode: 'living'
  },
  {
    id: 'bedford-park-society',
    name: 'Bedford Park Society',
    url: 'https://www.bedfordpark.org.uk/',
    homepage: 'https://www.bedfordpark.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Acton'],
    topics: ['Planning & development', 'Culture & history'],
    mode: 'dated-links'
  }
];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
function decode(value='') { return String(value).replace(/&#x([0-9a-f]+);?/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#([0-9]+);?/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&([a-z][a-z0-9]+);/gi,(m,n)=>entities[n.toLowerCase()]??m); }
function strip(value='') { return decode(String(value).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(); }

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),12000);
  try {
    const response = await fetch(url,{redirect:'follow',signal:controller.signal,headers:{accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5','accept-language':'en-GB,en;q=0.9','user-agent':'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

function absoluteUrl(href,base) { try { const u=new URL(decode(href),base); if(!/^https?:$/.test(u.protocol)) return null; u.hash=''; return u; } catch { return null; } }
function sameHost(a,b) { return a.replace(/^www\./i,'').toLowerCase()===b.replace(/^www\./i,'').toLowerCase(); }
function dateIso(raw) { const ts=Date.parse(String(raw||'').replace(/(\d)(st|nd|rd|th)/i,'$1')); return Number.isNaN(ts)?null:new Date(ts).toISOString(); }
function parseDate(value='') {
  const patterns=[/\b([0-3]?\d(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})\b/i,/\b([A-Za-z]+\s+[0-3]?\d,\s+20\d{2})\b/i,/\b(20\d{2}-\d{2}-\d{2})\b/];
  for(const p of patterns){const m=String(value).match(p);if(m){const iso=dateIso(m[1]);if(iso)return iso;}}
  return null;
}
function meta(html,name) {
  const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const rx1=new RegExp(`<meta\\b[^>]*(?:name|property)=["']${safe}["'][^>]*content=["']([^"']+)["'][^>]*>`,'i');
  const rx2=new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${safe}["'][^>]*>`,'i');
  return decode((html.match(rx1)||html.match(rx2)||[])[1]||'');
}
function articleBody(html='') {
  const article=String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main=String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  return strip(article||main||'');
}
function articleDate(html='') {
  return dateIso(meta(html,'article:published_time')) || dateIso(meta(html,'date')) || dateIso((html.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)||[])[1]) || dateIso((html.match(/"datePublished"\s*:\s*"([^"]+)"/i)||[])[1]) || parseDate(articleBody(html));
}
function titleFromHtml(html='') { return strip(meta(html,'og:title') || (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1] || (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]); }
function descriptionFromHtml(html='') { return strip(meta(html,'description') || meta(html,'og:description') || articleBody(html)).slice(0,700); }
function topicGuess(text,defaults=[]) {
  const v=String(text).toLowerCase();
  const rules=[['Planning & development',/planning|development|regeneration|conservation|application/],['Housing',/housing|tenant|rent|homeless/],['Environment',/environment|litter|waste|recycling|park|tree|river|pollution/],['Transport',/traffic|transport|bus|rail|road|parking|cycle/],['Schools & young people',/school|education|children|young people|youth/],['Policing & safety',/police|crime|safety|antisocial|anti-social/],['Council & democracy',/council|councillor|consultation|committee|election|petition/],['Community',/community|resident|volunteer|neighbourhood|local/],['Culture & history',/heritage|history|conservation|architecture|festival/]];
  return [...new Set([...rules.filter(([,r])=>r.test(v)).map(([n])=>n),...defaults])].slice(0,4);
}

function sectionHtml(source,html) {
  if(!source.startMarker) return html;
  const lower=html.toLowerCase();
  const start=lower.indexOf(source.startMarker.toLowerCase());
  if(start<0) return html;
  const end=source.endMarker ? lower.indexOf(source.endMarker.toLowerCase(),start+source.startMarker.length) : -1;
  return html.slice(start,end>start?end:undefined);
}

function candidateLinks(source,html) {
  const scope=sectionHtml(source,html);
  const rx=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out=[]; let m;
  const origin=new URL(source.url).hostname;
  while((m=rx.exec(scope))){
    const url=absoluteUrl(m[1],source.url); if(!url||!sameHost(url.hostname,origin)) continue;
    if(url.pathname==='/' || /\/(?:about|contact|join|membership|events?|gallery|planning|issues?|privacy|wp-admin|feed)\/?$/i.test(url.pathname)) continue;
    const title=strip(m[2]); if(title.length<10||title.length>220||/^(read more|learn more|view more)$/i.test(title)) continue;
    out.push({url:url.href,title});
  }
  return [...new Map(out.map(x=>[x.url,x])).values()].slice(0,18);
}

async function datedItems(source,listingHtml) {
  const candidates=candidateLinks(source,listingHtml);
  const items=(await Promise.all(candidates.map(async entry=>{
    try {
      const html=await fetchHtml(entry.url);
      const publishedAt=articleDate(html); if(!publishedAt) return null;
      const title=titleFromHtml(html)||entry.title;
      const summary=descriptionFromHtml(html);
      const hash=createHash('sha256').update(entry.url).digest('hex').slice(0,16);
      return {id:`${source.id}:${hash}`,sourceId:source.id,source:source.name,sourceClass:source.sourceClass,sourceHomepage:source.homepage,mediaType:null,title,url:entry.url,canonicalUrl:entry.url,summary,publishedAt,towns:source.towns,topics:topicGuess(`${title} ${summary}`,source.topics),derived:true,derivedFrom:'First-party community/residents publication page; article metadata and scoped content extracted conservatively'};
    } catch { return null; }
  }))).filter(Boolean);
  return items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,12);
}

function livingItem(source,html) {
  const body=articleBody(html) || strip(html);
  const useful=body.replace(/\s+/g,' ').trim();
  if(useful.length<120) return [];
  const hash=createHash('sha256').update(useful).digest('hex').slice(0,16);
  const title=titleFromHtml(html) || `${source.name} — current publication`;
  return [{id:`${source.id}:${hash}`,sourceId:source.id,source:source.name,sourceClass:source.sourceClass,sourceHomepage:source.homepage,mediaType:null,title,url:source.url,canonicalUrl:`${source.url}#commons-version-${hash}`,summary:descriptionFromHtml(html)||useful.slice(0,700),publishedAt:null,towns:source.towns,topics:topicGuess(`${title} ${useful}`,source.topics),derived:true,derivedFrom:'Content-hashed first-party living publication page; no publication date invented'}];
}

async function fetchSource(source){ const html=await fetchHtml(source.url); return source.mode==='dated-links' ? await datedItems(source,html) : livingItem(source,html); }

export async function fetchCommunityGapSources(){
  const results=await Promise.allSettled(sources.map(async source=>({source,items:await fetchSource(source)})));
  const items=[]; const health=[];
  results.forEach((result,index)=>{const source=sources[index]; if(result.status==='fulfilled'){items.push(...result.value.items);health.push({id:source.id,name:source.name,homepage:source.homepage,ok:true,status:result.value.items.length?'ok':'empty',itemCount:result.value.items.length,error:result.value.items.length?null:'Source fetched but no safely extractable current publication was found'});}else{health.push({id:source.id,name:source.name,homepage:source.homepage,ok:false,status:'error',itemCount:0,error:String(result.reason?.message||result.reason)});}});
  return {generatedAt:new Date().toISOString(),items,health};
}

export default async()=>new Response(JSON.stringify(await fetchCommunityGapSources()),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=900, stale-while-revalidate=1800','access-control-allow-origin':'*'}});
