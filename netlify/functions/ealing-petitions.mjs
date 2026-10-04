import { XMLParser } from 'fast-xml-parser';

const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const SOURCE = {
  id: 'ealing-council-petitions',
  name: 'Ealing Council — Petitions',
  homepage: 'https://ealing.moderngov.co.uk/mgEPetitionListDisplay.aspx?bcr=1',
  sourceClass: 'Official record'
};
const RELAY = process.env.MODERNGOV_PETITIONS_RELAY_URL || 'https://chat-dev.ealing.civiccommons.co.uk/_relay/moderngov/petitions';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const textValue = value => value?.['#text'] ?? value ?? '';

function cleanText(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseDate(value) {
  const timestamp = Date.parse(String(value || '').trim());
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function safeUrl(value) {
  try {
    const url = new URL(value, 'https://ealing.moderngov.co.uk/');
    return url.hostname === 'ealing.moderngov.co.uk' && /^https?:$/.test(url.protocol) ? url.toString() : SOURCE.homepage;
  } catch {
    return SOURCE.homepage;
  }
}

function placeFor(text) {
  const value = String(text)
    .replace(/\bEaling(?:\s+(?:Borough|Council|Council's|Council’s|Council’s|Council's))?\b(?=\s+(?:Council|borough|council))/gi, ' ')
    .replace(/\bLondon Borough of Ealing\b/gi, ' ')
    .replace(/\bEaling Council\b/gi, ' ');
  const patterns = {
    Ealing: /\b(?:Ealing Broadway|West Ealing|North Ealing|South Ealing|Ealing)\b/i,
    Acton: /\bActon\b/i,
    Greenford: /\bGreenford\b/i,
    Hanwell: /\bHanwell\b/i,
    Northolt: /\bNortholt\b/i,
    Perivale: /\bPerivale\b/i,
    Southall: /\bSouthall\b/i
  };
  const towns = BOROUGH_TOWNS.filter(town => patterns[town].test(value));
  return { towns: towns.length ? towns : BOROUGH_TOWNS, boroughWide: towns.length === 0 };
}

function topicsFor(text) {
  const value = String(text).toLowerCase();
  const topics = ['Council & democracy'];
  const add = topic => { if (!topics.includes(topic)) topics.unshift(topic); };
  if (/planning|development|regeneration|construction/.test(value)) add('Planning & development');
  if (/housing|tenant|rent|homeless/.test(value)) add('Housing');
  if (/park|tree|environment|climate|pollution|air quality|waste/.test(value)) add('Environment');
  if (/traffic|transport|road|parking|cycle|bus|rail/.test(value)) add('Transport');
  if (/school|education|children|young people|youth/.test(value)) add('Schools & young people');
  return topics.slice(0, 3);
}

function normaliseItem(entry) {
  const title = cleanText(textValue(entry?.title) || textValue(entry?.description));
  if (!title) return null;
  const description = cleanText(textValue(entry?.description ?? entry?.summary ?? entry?.content));
  const publishedAt = normaliseDate(textValue(entry?.pubDate ?? entry?.published ?? entry?.updated));
  const linkValue = typeof entry?.link === 'string'
    ? entry.link
    : Array.isArray(entry?.link)
      ? (entry.link.find(link => link?.['@_rel'] === 'alternate')?.['@_href'] || entry.link[0]?.['@_href'])
      : entry?.link?.['@_href'];
  const url = safeUrl(linkValue);
  const identity = cleanText(textValue(entry?.guid ?? entry?.id)) || url || `${publishedAt || ''}|${title}`;
  const place = placeFor(`${title} ${description}`);

  return {
    id: `${SOURCE.id}:${identity}`,
    sourceId: SOURCE.id,
    source: SOURCE.name,
    sourceClass: SOURCE.sourceClass,
    sourceHomepage: SOURCE.homepage,
    mediaType: null,
    contentType: 'Petition',
    title,
    url,
    canonicalUrl: url,
    dedupeKey: `${SOURCE.id}:${identity}`,
    summary: description ? description.slice(0, 420) : `Official Ealing Council petition: ${title}`.slice(0, 420),
    publishedAt,
    towns: place.towns,
    boroughWide: place.boroughWide,
    topics: topicsFor(`${title} ${description}`),
    derived: true,
    derivedFrom: 'Imported from Ealing Council’s official ModernGov petitions feed',
    aiGenerated: false
  };
}

export async function fetchEalingPetitions() {
  const started = Date.now();
  try {
    const response = await fetch(RELAY, {
      redirect: 'follow',
      headers: { accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'user-agent': 'Ealing-Civic-Commons/1.0' }
    });
    if (!response.ok) throw new Error(`Petitions relay HTTP ${response.status}`);
    const parsed = parser.parse(await response.text());
    const rawItems = asArray(parsed?.rss?.channel?.item ?? parsed?.feed?.entry);
    const items = rawItems.map(normaliseItem).filter(Boolean);
    return {
      generatedAt: new Date().toISOString(),
      items,
      health: [{ id: SOURCE.id, name: SOURCE.name, homepage: SOURCE.homepage, ok: true, status: 'live', itemCount: items.length, elapsedMs: Date.now() - started }]
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      health: [{ id: SOURCE.id, name: SOURCE.name, homepage: SOURCE.homepage, ok: false, status: 'upstream', error: String(error?.message || error), itemCount: 0, elapsedMs: Date.now() - started }]
    };
  }
}

export default async () => {
  const result = await fetchEalingPetitions();
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=120, stale-while-revalidate=600' }
  });
};
