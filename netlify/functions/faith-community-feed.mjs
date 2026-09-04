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
    include: /community|interfaith|council|housing|refugee|asylum|poverty|food|school|justice|citizens|environment|campaign|public meeting|sick|housebound|nursing homes|water/i,
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
    sectionStart: /EVENTS\s+WHAT.?S ON\s+ST JOHN.?S CHURCH,\s*SOUTHALL/i,
    sectionStop: /(?:Venue Hire|Little Angels|Bumps\s*&\s*Babies|Giving|Footer|©)/i,
    topics: ['Community']
  },
  {
    id: 'west-london-college-ealing-civic',
    name: 'West London College — Ealing/Southall civic news',
    url: 'https://www.wlc.ac.uk/news/?year1=2026',
    homepage: 'https://www.wlc.ac.uk/',
    sourceClass: 'Community / education',
    towns: ['Ealing', 'Southall'],
    mode: 'wlc-news',
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

async function requestHtml(url, browserCompatible=false) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), browserCompatible ? 18000 : 9000);
  try {
    return await fetch(url,{
      redirect:'follow',
      signal:controller.signal,
      headers:{
        accept:browserCompatible ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language':'en-GB,en;q=0.9',
        'user-agent':browserCompatible ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' : 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
  } finally { clearTimeout(timeout); }
}

async function fetchHtml(url) {
  let response;
  try { response = await requestHtml(url,false); } catch {}
  if (!response?.ok) response = await requestHtml(url,true);
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
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

function metaDescription(html='') {
  const match = String(html).match(/<meta\b[^>]*(?:name=["']description["']|property=["']og:description["'])[^>]*content=["']([^"']+)["'][^>]*>/i)
    || String(html).match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:name=["']description["']|property=["']og:description["'])[^>]*>/i);
  return match ? strip(match[1]) : '';
}

async function wlcItems(source, html) {
  const links = [];
  const rx = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = rx.exec(html))) {
    let url;
    try { url = new URL(match[1], source.url); } catch { continue; }
    if (!/^(?:www\.)?wlc\.ac\.uk$/i.test(url.hostname) || !/^\/news\/[a-z0-9][a-z0-9-]+\/?$/i.test(url.pathname)) continue;
    const title = strip(match[2]);
    if (title.length < 12 || title.length > 220 || !source.include.test(title)) continue;
    links.push({ url: url.href, title });
  }

  const unique = [...new Map(links.map(entry => [entry.url, entry])).values()].slice(0, 12);
  const enriched = await Promise.all(unique.map(async entry => {
    try {
      const articleHtml = await fetchHtml(entry.url);
      const text = strip(articleHtml);
      const dateMatch = text.match(/\b([0-3]?\d(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2}|[A-Z][a-z]+\s+\d{1,2},\s+20\d{2})\b/);
      const publishedAt = dateMatch ? dateIso(dateMatch[1].replace(/(\d)(st|nd|rd|th)/i,'$1')) : null;
      const summary = metaDescription(articleHtml);
      return {
        id: `${source.id}:${entry.url}`,
        sourceId: source.id,
        source: source.name,
        sourceClass: source.sourceClass,
        sourceHomepage: source.homepage,
        mediaType: null,
        title: entry.title,
        url: entry.url,
        canonicalUrl: entry.url,
        summary: summary.slice(0, 700),
        publishedAt,
        towns: source.towns,
        topics: source.topics,
        derived: true,
        derivedFrom: 'West London College first-party news listing and canonical article metadata'
      };
    } catch { return null; }
  }));
  return enriched.filter(Boolean).sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0));
}

function livingItem(source, html) {
  const text = strip(html);
  const startMatch = text.match(source.sectionStart); if(!startMatch) return null;
  let section = text.slice(startMatch.index, startMatch.index + 2600).trim();
  const stop = section.slice(Math.min(80, section.length)).search(source.sectionStop);
  if(stop >= 0) section=section.slice(0, stop + Math.min(80, section.length)).trim();
  if(section.length<100) return null;
  const hash=createHash('sha256').update(section).digest('hex').slice(0,16);
  return { id:`${source.id}:${hash}`, sourceId:source.id, source:source.name, sourceClass:source.sourceClass, sourceHomepage:source.homepage, mediaType:null, title:`${source.name}: current community programme`, url:source.url, canonicalUrl:`${source.url}#commons-version-${hash}`, summary:section.slice(0,800), publishedAt:null, towns:source.towns, topics:source.topics, derived:true, derivedFrom:'Content-hashed living community/outreach page; no publication date invented' };
}

export async function fetchFaithCommunityFeed() {
  const results=await Promise.allSettled(sources.map(async source=>({source,html:await fetchHtml(source.url)})));
  const items=[]; const health=[];
  for (let index=0; index<results.length; index+=1) {
    const result=results[index]; const source=sources[index];
    if(result.status==='fulfilled'){
      let found;
      if (source.mode==='living') found=[livingItem(source,result.value.html)].filter(Boolean);
      else if (source.mode==='wlc-news') found=await wlcItems(source,result.value.html);
      else found=datedItems(source,result.value.html);
      items.push(...found); health.push({id:source.id,name:source.name,homepage:source.homepage,ok:true,status:found.length?'ok':'empty',itemCount:found.length,error:found.length?null:'Page fetched but no current civic/community material matched the source rules'});
    } else health.push({id:source.id,name:source.name,homepage:source.homepage,ok:false,status:'error',itemCount:0,error:String(result.reason?.message||result.reason)});
  }
  return {generatedAt:new Date().toISOString(),items,health};
}

export default async()=>new Response(JSON.stringify(await fetchFaithCommunityFeed()),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, stale-while-revalidate=900','access-control-allow-origin':'*'}});
