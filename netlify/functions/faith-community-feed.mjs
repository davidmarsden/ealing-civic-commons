import { createHash } from 'node:crypto';

const sources = [
  {
    id: 'ealing-synagogue-civic',
    name: 'Ealing Synagogue — civic/community updates',
    url: 'https://ealingsynagogue.org.uk/',
    homepage: 'https://ealingsynagogue.org.uk/',
    sourceClass: 'Community / faith',
    towns: ['Ealing'],
    mode: 'dated',
    include: /council|interfaith|community|holocaust memorial|town hall|civic|school|refugee|mosque|synagogue attack|hate crime/i,
    topics: ['Community', 'Council & democracy']
  },
  {
    id: 'st-anselm-southall-civic',
    name: 'St Anselm’s Catholic Church Southall — civic/community updates',
    url: 'https://parish.rcdow.org.uk/southall/',
    homepage: 'https://parish.rcdow.org.uk/southall/',
    sourceClass: 'Community / faith',
    towns: ['Southall'],
    mode: 'dated',
    include: /community|interfaith|council|housing|refugee|asylum|poverty|food|school|justice|citizens|environment|campaign|public meeting/i,
    topics: ['Community']
  },
  {
    id: 'st-john-southall-community',
    name: 'St John’s Southall Green — community outreach',
    url: 'https://www.stjohnsouthall.org.uk/events',
    homepage: 'https://www.stjohnsouthall.org.uk/',
    sourceClass: 'Community / faith',
    towns: ['Southall'],
    mode: 'living',
    sectionStart: /WHAT.?S ON/i,
    sectionStop: /St John.?s Southall Green/i,
    topics: ['Community']
  },
  {
    id: 'west-london-college-ealing-civic',
    name: 'West London College — Ealing/Southall civic news',
    url: 'https://www.wlc.ac.uk/news/?year1=2026',
    homepage: 'https://www.wlc.ac.uk/',
    sourceClass: 'Community / education',
    towns: ['Ealing', 'Southall'],
    mode: 'dated',
    include: /Ealing|Southall|community|MP|council|TfL|health|housing|climate|environment|citizens|documentary|public/i,
    topics: ['Community', 'Schools & young people']
  },
  {
    id: 'villiers-high-school-civic',
    name: 'Villiers High School — civic/community bulletin',
    url: 'https://villiershighschool.blog/',
    homepage: 'https://www.villiers.ealing.sch.uk/',
    sourceClass: 'Community / education',
    towns: ['Southall'],
    mode: 'dated',
    include: /Southall|community|council|councillor|police|Metropolitan Police|Darussalam|mosque|citizens|local area|antisocial|anti-social|public health|environment|housing|safeguarding|governor/i,
    topics: ['Community', 'Schools & young people']
  }
];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', ndash: '–', mdash: '—' };
function decode(value='') { return String(value).replace(/&#x([0-9a-f]+);?/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#([0-9]+);?/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&([a-z][a-z0-9]+);/gi,(m,n)=>entities[n.toLowerCase()]??m); }
function strip(value='') { return decode(String(value).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim(); }

async function fetchHtml(url) {
  const controller = new AbortController(); const timeout = setTimeout(()=>controller.abort(),8000);
  try {
    const response = await fetch(url,{redirect:'follow',signal:controller.signal,headers:{accept:'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5','accept-language':'en-GB,en;q=0.9','user-agent':'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'}});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

function dateIso(raw) {
  const ts = Date.parse(raw); return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

function datedItems(source, html) {
  const text = strip(html);
  const dateRx = /(?:^|\s)([0-3]?\d(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2}|[0-3]?\d\s+[A-Za-z]+,?\s+20\d{2}|\d{1,2}\s+[A-Z][a-z]{2}\s+20\d{2}|[A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/g;
  const dates = [...text.matchAll(dateRx)];
  const out = [];
  dates.forEach((match,index)=>{
    const start = Math.max(0, match.index - 260);
    const end = index + 1 < dates.length ? Math.min(text.length, dates[index+1].index) : Math.min(text.length, match.index + 700);
    const block = text.slice(start,end).trim();
    if (!source.include.test(block)) return;
    const publishedAt = dateIso(match[1].replace(/(\d)(st|nd|rd|th)/i,'$1'));
    if (!publishedAt) return;
    let title = block.slice(0,180).replace(match[0],'').trim();
    const sentence = title.match(/[^.!?]{12,160}/); title = sentence ? sentence[0].trim() : title;
    if (title.length < 12) title = `${source.name}: community update`;
    const hash = createHash('sha256').update(`${publishedAt}|${block}`).digest('hex').slice(0,16);
    out.push({ id:`${source.id}:${hash}`, sourceId:source.id, source:source.name, sourceClass:source.sourceClass, sourceHomepage:source.homepage, mediaType:null, title, url:source.url, canonicalUrl:`${source.url}#commons-version-${hash}`, summary:block.slice(0,700), publishedAt, towns:source.towns, topics:source.topics, derived:true, derivedFrom:'Public publisher page; dated civic/community block extracted conservatively' });
  });
  return [...new Map(out.map(item=>[item.id,item])).values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,12);
}

function livingItem(source, html) {
  const text = strip(html);
  const startMatch = text.match(source.sectionStart); if(!startMatch) return null;
  let section = text.slice(startMatch.index, startMatch.index + 2600);
  const stop = section.slice(50).search(source.sectionStop); if(stop>100) section=section.slice(0,stop+50);
  section=section.trim(); if(section.length<100) return null;
  const hash=createHash('sha256').update(section).digest('hex').slice(0,16);
  return { id:`${source.id}:${hash}`, sourceId:source.id, source:source.name, sourceClass:source.sourceClass, sourceHomepage:source.homepage, mediaType:null, title:`${source.name}: current community programme`, url:source.url, canonicalUrl:`${source.url}#commons-version-${hash}`, summary:section.slice(0,800), publishedAt:null, towns:source.towns, topics:source.topics, derived:true, derivedFrom:'Content-hashed living community/outreach page; no publication date invented' };
}

export async function fetchFaithCommunityFeed() {
  const results=await Promise.allSettled(sources.map(async source=>({source,html:await fetchHtml(source.url)})));
  const items=[]; const health=[];
  results.forEach((result,index)=>{
    const source=sources[index];
    if(result.status==='fulfilled'){
      const found=source.mode==='living' ? [livingItem(source,result.value.html)].filter(Boolean) : datedItems(source,result.value.html);
      items.push(...found); health.push({id:source.id,name:source.name,homepage:source.homepage,ok:true,status:found.length?'ok':'empty',itemCount:found.length,error:found.length?null:'Page fetched but no current civic/community material matched the source rules'});
    } else health.push({id:source.id,name:source.name,homepage:source.homepage,ok:false,status:'error',itemCount:0,error:String(result.reason?.message||result.reason)});
  });
  return {generatedAt:new Date().toISOString(),items,health};
}

export default async()=>new Response(JSON.stringify(await fetchFaithCommunityFeed()),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, stale-while-revalidate=900','access-control-allow-origin':'*'}});
