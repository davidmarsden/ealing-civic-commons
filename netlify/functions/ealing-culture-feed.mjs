const HOME = 'https://ealingculture.org/';
const API = new URL('/wp-json/wp/v2/', HOME);
const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const USER_AGENT = 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)';

const TYPES = {
  event: { taxonomies: ['audience', 'event-type', 'town'] },
  news: { taxonomies: ['news-category', 'town'] },
  venue: { taxonomies: ['suitability', 'venue-town', 'venue-type'] },
  creative: { taxonomies: ['creative---business-type', 'creative-category', 'creative---location'] }
};

const CIVIC_EVENT_TERMS = /\b(?:community|communities|public art|local history|heritage|library|libraries|museum|civic|council|borough|neighbourhood|neighborhood|public realm|regeneration|consultation|awareness|foodbank|food bank|green space|environment|climate|town hall|community centre|community center|volunteer|volunteering|young people|youth|school|schools|accessibility|inclusion|inclusive|history awareness|community day)\b/i;

function decode(value = '') {
  return String(value)
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function strip(value = '') {
  return decode(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function utc(value, fallback = null) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return null;
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(explicit);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchJson(url, timeout = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'application/json', 'accept-language': 'en-GB,en;q=0.9', 'user-agent': USER_AGENT }
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${response.url}`);
    return { response, json: JSON.parse(text) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCollection(restBase, { embed = true } = {}) {
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = new URL(restBase, API);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    if (embed) url.searchParams.set('_embed', '1');
    const { response, json } = await fetchJson(url);
    if (!Array.isArray(json)) throw new Error(`Expected array from ${url}`);
    rows.push(...json);
    totalPages = Number(response.headers.get('x-wp-totalpages') || 1);
    page += 1;
  } while (page <= totalPages);
  return rows;
}

async function loadTaxonomies() {
  const names = [...new Set(Object.values(TYPES).flatMap(type => type.taxonomies))];
  const maps = {};
  const warnings = [];
  await Promise.all(names.map(async name => {
    try {
      const rows = await fetchCollection(name, { embed: false });
      maps[name] = new Map(rows.map(row => [Number(row.id), { id: Number(row.id), name: row.name, slug: row.slug, link: row.link }]));
    } catch (error) {
      maps[name] = new Map();
      warnings.push(`taxonomy_fetch_failed:${name}:${error?.message || error}`);
    }
  }));
  return { maps, warnings };
}

function terms(row, taxonomy, maps) {
  const ids = Array.isArray(row?.[taxonomy]) ? row[taxonomy].map(Number) : [];
  return ids.map(id => maps[taxonomy]?.get(id)).filter(Boolean);
}

function names(row, taxonomy, maps) {
  return terms(row, taxonomy, maps).map(term => term.name).filter(Boolean);
}

function townShape(sourceLocations = []) {
  const towns = sourceLocations.filter(name => BOROUGH_TOWNS.includes(name));
  const boroughWide = sourceLocations.includes('Boroughwide');
  const crossBoundary = sourceLocations.includes('Park Royal');
  return { towns, boroughWide, crossBoundary, sourceLocations };
}

function topicGuess(text = '', extra = []) {
  const value = `${text} ${extra.join(' ')}`.toLowerCase();
  const topics = ['Culture & history'];
  if (/community|library|public art|local history|heritage|museum|foodbank|green space/.test(value)) topics.push('Community');
  if (/school|children|young people|youth|student/.test(value)) topics.push('Schools & young people');
  if (/council|funding|grant|consultation|opportunit|vacanc|role|regeneration|public realm/.test(value)) topics.push('Council & democracy');
  return [...new Set(topics)].slice(0, 3);
}

function baseItem(row, kind, maps) {
  const title = strip(row.title?.rendered ?? row.title ?? '');
  const body = strip(row.content?.rendered ?? '');
  const excerpt = strip(row.excerpt?.rendered ?? '');
  const summaryText = excerpt || body;
  const summary = summaryText.length > 420 ? `${summaryText.slice(0, 417).trimEnd()}…` : summaryText;
  const sourceLocations = names(row, 'town', maps);
  const place = townShape(sourceLocations);
  const cats = kind === 'event' ? names(row, 'event-type', maps) : names(row, 'news-category', maps);
  return {
    id: `ealing-culture:${kind}:${row.id}`,
    sourceId: 'ealing-culture',
    source: 'Ealing Culture — Ealing Council',
    sourceClass: 'Official record',
    sourceHomepage: HOME,
    mediaType: null,
    title,
    url: row.link,
    canonicalUrl: row.link,
    summary,
    publishedAt: utc(row.date_gmt, row.date),
    updatedAt: utc(row.modified_gmt, row.modified),
    towns: place.boroughWide ? BOROUGH_TOWNS : place.towns,
    boroughWide: place.boroughWide,
    crossBoundary: place.crossBoundary,
    sourceLocations,
    topics: topicGuess(`${title} ${summary}`, cats),
    derived: false,
    aiGenerated: false,
    contentLabel: kind === 'event' ? 'Civic / community event' : (cats.includes('Opportunities') ? 'Opportunity' : null),
    publisherCategories: cats,
    provenance: { source: 'Ealing Culture', owner: 'London Borough of Ealing', kind: 'official', recordId: row.id }
  };
}

function isCivicEvent(item) {
  const haystack = `${item.title || ''} ${item.summary || ''} ${(item.publisherCategories || []).join(' ')}`;
  return CIVIC_EVENT_TERMS.test(haystack);
}

function reference(row, kind, maps) {
  const title = strip(row.title?.rendered ?? row.title ?? '');
  const content = strip(row.content?.rendered ?? '');
  const excerpt = strip(row.excerpt?.rendered ?? '');
  const locationTaxonomy = kind === 'venue' ? 'venue-town' : 'creative---location';
  const sourceLocations = names(row, locationTaxonomy, maps);
  const place = townShape(sourceLocations);
  const categories = kind === 'venue' ? names(row, 'venue-type', maps) : names(row, 'creative-category', maps);
  const secondary = kind === 'venue' ? names(row, 'suitability', maps) : names(row, 'creative---business-type', maps);
  return {
    id: `ealing-culture:${kind}:${row.id}`,
    kind,
    title,
    description: content || excerpt || null,
    url: row.link,
    canonicalUrl: row.link,
    towns: place.towns,
    boroughWide: place.boroughWide,
    crossBoundary: place.crossBoundary,
    sourceLocations,
    categories,
    secondaryCategories: secondary,
    promotionPolicy: kind === 'creative' ? 'reference-only; do not auto-create civic person profiles' : 'reference-only until entity matching/promotion rules are applied',
    provenance: { source: 'Ealing Culture', owner: 'London Borough of Ealing', kind: 'official', recordId: row.id }
  };
}

export async function fetchEalingCultureFeed({ includeReferences = false } = {}) {
  const started = Date.now();
  const errors = [];
  const { maps, warnings } = await loadTaxonomies();
  const raw = {};
  for (const kind of Object.keys(TYPES)) {
    try {
      raw[kind] = await fetchCollection(kind);
    } catch (error) {
      raw[kind] = [];
      const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
      if (kind === 'event' || kind === 'news') errors.push(`collection_fetch_failed:${kind}:${message}`);
      else warnings.push(`reference_collection_fetch_failed:${kind}:${message}`);
    }
  }

  const allEventItems = raw.event.map(row => baseItem(row, 'event', maps));
  const eventItems = allEventItems.filter(isCivicEvent);
  const newsItems = raw.news.map(row => baseItem(row, 'news', maps));
  const references = includeReferences ? {
    venues: raw.venue.map(row => reference(row, 'venue', maps)),
    creatives: raw.creative.map(row => reference(row, 'creative', maps))
  } : { venues: [], creatives: [] };
  const items = [...eventItems, ...newsItems]
    .filter(item => item.title && item.url && item.publishedAt)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return {
    generatedAt: new Date().toISOString(),
    items,
    archiveItems: items,
    references,
    counts: {
      news: newsItems.length,
      eventsTotal: allEventItems.length,
      eventsCivic: eventItems.length,
      venues: raw.venue.length,
      creatives: raw.creative.length
    },
    warnings,
    errors,
    health: [{
      id: 'ealing-culture',
      name: 'Ealing Culture — Ealing Council',
      homepage: HOME,
      ok: errors.length === 0 && allEventItems.length > 0 && newsItems.length > 0,
      status: errors.length ? 'upstream' : 'ok',
      itemCount: items.length,
      error: errors.length ? errors.join('; ') : null,
      diagnostics: [{ mode: 'wordpress-rest-civic-filter', outcome: errors.length ? 'partial' : 'http-response', httpStatus: errors.length ? null : 200, elapsedMs: Date.now() - started }]
    }]
  };
}

export const _test = { isCivicEvent, topicGuess, townShape };

export default async () => new Response(JSON.stringify(await fetchEalingCultureFeed({ includeReferences: true })), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, stale-while-revalidate=900',
    'access-control-allow-origin': '*'
  }
});
