import { XMLParser } from 'fast-xml-parser';
import { getEalingDocumentMetadata, EALING_DOCUMENT_METADATA_TIMEOUT_MS } from '../lib/ealing-document-metadata.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const textValue = value => value?.['#text'] ?? value ?? '';
const DOCUMENT_TIMEOUT_MS = 1000;
const METADATA_ENRICH_LIMIT = 20;
const knownTowns = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];

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

function rawPeriod(rawTitle) {
  return strip(rawTitle).match(/^downloads?\s*:\s*(.+)$/i)?.[1]?.trim() || null;
}

function displayTitle(feed, rawTitle) {
  const title = strip(rawTitle) || 'Untitled council document';
  const genericDownload = title.match(/^downloads?\s*:\s*(.+)$/i);
  if (genericDownload) return `${feed.label} — ${genericDownload[1].trim()}`;
  if (/^downloads?$/i.test(title)) return feed.label;
  return title;
}

function inferTowns(value) {
  const text = String(value || '')
    .replace(/\b(?:the\s+)?London Borough of Ealing(?: Council)?\b/gi, ' ')
    .replace(/\bEaling Council\b/gi, ' ')
    .replace(/\bEaling LBC\b/gi, ' ');
  return knownTowns.filter(town => new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
}

function displaySummary(feed, rawTitle, description) {
  const cleaned = strip(description);
  if (cleaned && cleaned.toLowerCase() !== strip(rawTitle).toLowerCase()) return cleaned.slice(0, 420);
  return `Official Ealing Council document published in “${feed.label}”. The Commons keeps the council document as the canonical source.`;
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
    const items = rawItems.map(item => {
      const rawTitle = strip(textValue(item.title) || 'Untitled council document');
      const link = canonical(itemLink(item));
      const publishedAt = iso(item.pubDate ?? item.published ?? item.updated ?? item.date);
      const description = strip(textValue(item.description ?? item.summary ?? ''));
      const title = displayTitle(feed, rawTitle);
      const guid = textValue(item.guid) || link || `${feed.categoryId}:${rawTitle}`;
      const towns = inferTowns(`${rawTitle} ${description}`);
      return {
        id: `ealing-council-documents:${guid}`,
        sourceId: 'ealing-council-documents',
        source: 'Ealing Council — Document Watch',
        sourceClass: 'Official record',
        sourceHomepage: 'https://www.ealing.gov.uk/',
        title,
        rawSourceTitle: rawTitle,
        url: link || 'https://www.ealing.gov.uk/',
        canonicalUrl: link,
        summary: displaySummary(feed, rawTitle, description),
        publishedAt,
        towns,
        boroughWide: towns.length === 0,
        topics: [...new Set(feed.topics)].slice(0,3),
        officialCategories: [feed.label],
        documentCategory: feed.label,
        topicProvenance: 'Ealing Council document RSS',
        documentFeedCategoryId: feed.categoryId
      };
    });
    const dates = items.map(x => x.publishedAt).filter(Boolean).sort();
    const lastPublishedAt = dates.length ? dates[dates.length - 1] : null;
    return { ok:true, feed, items, itemCount:rawItems.length, lastPublishedAt, freshness:freshness(lastPublishedAt) };
  } finally { clearTimeout(timeout); }
}

async function enrichDocumentMetadata(items) {
  const candidates = [...items]
    .filter(item => item.canonicalUrl && rawPeriod(item.rawSourceTitle))
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, METADATA_ENRICH_LIMIT);

  const settled = await Promise.allSettled(candidates.map(async item => {
    const metadata = await getEalingDocumentMetadata(item.canonicalUrl, item.rawSourceTitle);
    if (!metadata?.description) return false;
    const period = rawPeriod(item.rawSourceTitle);
    item.documentDescription = metadata.description;
    item.title = period ? `${metadata.description} — ${period}` : metadata.description;
    item.summary = `Ealing Council classifies this document under “${item.documentCategory}”. The original council document remains the canonical source.`;
    const metadataTowns = inferTowns(metadata.description);
    item.towns = [...new Set([...(item.towns || []), ...metadataTowns])];
    item.boroughWide = item.towns.length === 0;
    item.metadataEnriched = true;
    return true;
  }));

  return settled.filter(result => result.status === 'fulfilled' && result.value).length;
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
  const metadataEnriched = await enrichDocumentMetadata(deduped);
  const responding = feedHealth.filter(x => x.ok).length;
  return {
    source: { id:'ealing-council-documents', name:'Ealing Council — Document Watch', homepage:'https://www.ealing.gov.uk/', sourceClass:'Official record' },
    ok: responding > 0,
    status: responding > 0 ? 'ok' : 'error',
    error: responding > 0 ? null : 'All enabled Ealing Council document feeds unavailable',
    items: deduped,
    diagnostics: { enabledFeeds:feeds.length, respondingFeeds:responding, timeoutMs:DOCUMENT_TIMEOUT_MS, metadataEnrichLimit:METADATA_ENRICH_LIMIT, metadataTimeoutMs:EALING_DOCUMENT_METADATA_TIMEOUT_MS, metadataEnriched, feeds:feedHealth }
  };
}
