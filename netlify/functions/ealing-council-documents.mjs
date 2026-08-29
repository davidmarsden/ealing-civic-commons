import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const textValue = value => value?.['#text'] ?? value ?? '';
const towns = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const DOCUMENT_TIMEOUT_MS = 1000;

const feeds = [
  ['201033','Council and local decisions',['Council & democracy']],
  ['201041','Council budgets and spending',['Council & democracy']],
  ['201072','Strategies, plans and policies',['Council & democracy']],
  ['201304','Climate action',['Environment']],
  ['201018','Tenders and contracts',['Council & democracy']],
  ['201322','Local Government Pension Scheme',['Council & democracy']],
  ['201086','Housing',['Housing']],
  ['201343','Housing performance',['Housing']],
  ['201104','Housing regeneration',['Housing','Planning & development']],
  ['201151','Pollution',['Environment']],
  ['201199','Air quality',['Environment']],
  ['201162','Planning policy',['Planning & development']],
  ['201164','Local Plan',['Planning & development']],
  ['201283','Our neighbourhoods',['Planning & development','Environment','Community']],
  ['201167','Rubbish and recycling',['Environment']],
  ['201182','Transport strategies and plans',['Transport']]
].map(([categoryId,label,topics]) => ({ categoryId, label, topics, url:`https://www.ealing.gov.uk/rss/${categoryId}/downloads` }));

function strip(value='') {
  return String(value).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
}

function itemLink(item) {
  const raw = item?.link;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.find(x => x?.['@_rel'] === 'alternate')?.['@_href'] || raw[0]?.['@_href'] || null;
  return raw?.['@_href'] || null;
}

function canonical(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/,'');
    return url.toString();
  } catch { return String(value).trim(); }
}

function iso(value) {
  const parsed = Date.parse(String(value || ''));
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function freshness(lastPublishedAt) {
  if (!lastPublishedAt) return 'empty';
  const days = Math.floor((Date.now() - Date.parse(lastPublishedAt)) / 86400000);
  if (days <= 180) return 'active';
  if (days <= 730) return 'quiet';
  return 'historical';
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOCUMENT_TIMEOUT_MS);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parser.parse(await response.text());
    const channel = parsed?.rss?.channel;
    if (!channel) throw new Error('Unrecognized RSS feed structure');
    const rawItems = arr(channel.item);
    const items = rawItems.slice(0, 20).map(item => {
      const title = strip(textValue(item.title) || 'Untitled council document');
      const link = canonical(itemLink(item));
      const publishedAt = iso(item.pubDate ?? item.published ?? item.updated ?? item.date);
      const description = strip(textValue(item.description ?? item.summary ?? ''));
      const guid = textValue(item.guid) || link || title;
      return {
        id: `ealing-council-documents:${guid}`,
        sourceId: 'ealing-council-documents',
        source: 'Ealing Council — Document Watch',
        sourceClass: 'Official record',
        sourceHomepage: 'https://www.ealing.gov.uk/',
        title,
        url: link || 'https://www.ealing.gov.uk/',
        canonicalUrl: link,
        summary: description.slice(0, 420),
        publishedAt,
        towns,
        topics: [...new Set(feed.topics)].slice(0,3),
        officialCategories: [feed.label],
        topicProvenance: 'Ealing Council document RSS',
        documentFeedCategoryId: feed.categoryId
      };
    });
    const dates = items.map(x => x.publishedAt).filter(Boolean).sort();
    const lastPublishedAt = dates.length ? dates[dates.length - 1] : null;
    return { ok:true, feed, items, itemCount:rawItems.length, lastPublishedAt, freshness:freshness(lastPublishedAt) };
  } finally { clearTimeout(timeout); }
}

export async function fetchEalingCouncilDocuments() {
  const settled = await Promise.allSettled(feeds.map(fetchFeed));
  const items = [];
  const feedHealth = [];
  for (let i=0;i<settled.length;i++) {
    const result = settled[i];
    const feed = feeds[i];
    if (result.status === 'fulfilled') {
      items.push(...result.value.items);
      feedHealth.push({ categoryId:feed.categoryId, label:feed.label, ok:true, itemCount:result.value.itemCount, lastPublishedAt:result.value.lastPublishedAt, freshness:result.value.freshness });
    } else {
      feedHealth.push({ categoryId:feed.categoryId, label:feed.label, ok:false, itemCount:0, lastPublishedAt:null, freshness:'unavailable', error:result.reason?.name === 'AbortError' ? 'Timed out' : String(result.reason?.message || result.reason) });
    }
  }
  const seen = new Set();
  const deduped = items.filter(item => {
    const key = item.canonicalUrl || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const responding = feedHealth.filter(x => x.ok).length;
  return {
    source: { id:'ealing-council-documents', name:'Ealing Council — Document Watch', homepage:'https://www.ealing.gov.uk/', sourceClass:'Official record' },
    ok: responding > 0,
    status: responding > 0 ? 'ok' : 'error',
    error: responding > 0 ? null : 'All enabled Ealing Council document feeds unavailable',
    items: deduped,
    diagnostics: { enabledFeeds:feeds.length, respondingFeeds:responding, timeoutMs:DOCUMENT_TIMEOUT_MS, feeds:feedHealth }
  };
}
