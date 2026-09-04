import { XMLParser } from 'fast-xml-parser';

const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];

const RSS_SOURCES = [
  {
    id: 'positive-greenford',
    name: 'Positive Greenford',
    url: 'https://positivegreenford.com/feed/',
    homepage: 'https://positivegreenford.com/',
    sourceClass: 'Journalism / publishing',
    towns: ['Greenford'],
    defaultTopics: ['Community']
  },
  {
    id: 'ealing-wildlife-group',
    name: 'Ealing Wildlife Group',
    url: 'https://ealingwildlifegroup.com/feed/',
    fallbackUrl: 'https://ealingwildlifegroup.com/blog/',
    homepage: 'https://ealingwildlifegroup.com/',
    sourceClass: 'Organisation / campaign',
    towns: BOROUGH_TOWNS,
    boroughWide: true,
    defaultTopics: ['Environment', 'Community']
  },
  {
    id: 'around-ealing',
    name: 'Around Ealing',
    url: 'https://www.aroundealing.com/feed/',
    homepage: 'https://www.aroundealing.com/',
    sourceClass: 'Official record',
    towns: BOROUGH_TOWNS,
    boroughWide: true,
    authoritativeTownCategories: true,
    defaultTopics: ['Community']
  }
];

const VISIONS = {
  id: 'visions-for-northolt',
  name: 'Visions for Northolt',
  url: 'https://www.visionsfornortholt.co.uk/news.html',
  homepage: 'https://www.visionsfornortholt.co.uk/',
  sourceClass: 'Official record',
  towns: ['Northolt'],
  defaultTopics: ['Community', 'Planning & development']
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', pound: '£' };

function decodeEntities(value = '') {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isInteger(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    })
    .replace(/&#([0-9]+);?/g, (match, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match);
}

function strip(html = '') {
  return decodeEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseDate(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function topicGuess(text = '', defaults = []) {
  const value = String(text).toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|construction|section 106|public realm|active travel/],
    ['Housing', /housing|homes|tenant|rent|homeless/],
    ['Environment', /wildlife|nature|beaver|hedgehog|peregrine|biodiversity|park|green space|climate|environment|river|tree/],
    ['Transport', /transport|traffic|bus|rail|station|road|parking|cycle|active travel|step-free/],
    ['Schools & young people', /school|children|young people|youth|education/],
    ['Policing & safety', /police|crime|antisocial|anti-social|safety|arrest/],
    ['Culture & history', /history|heritage|arts|culture|museum|festival/],
    ['Council & democracy', /council|councillor|election|ward|consultation|committee|section 106/]
  ];
  return [...new Set([...rules.filter(([, rx]) => rx.test(value)).map(([name]) => name), ...defaults])].slice(0, 3);
}

async function fetchText(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: accept || 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    return { response, text: response.ok ? await response.text() : '' };
  } finally {
    clearTimeout(timer);
  }
}

function categoryText(category) {
  return strip(category?.['#text'] ?? category ?? '');
}

function rssItems(source, xml = '') {
  const parsed = parser.parse(xml);
  const entries = arr(parsed?.rss?.channel?.item);
  const items = [];

  for (const entry of entries) {
    const title = strip(entry?.title?.['#text'] ?? entry?.title ?? '');
    const link = String(entry?.link?.['#text'] ?? entry?.link ?? '').trim();
    const publishedAt = normaliseDate(entry?.pubDate?.['#text'] ?? entry?.pubDate ?? entry?.['dc:date']);
    if (!title || !link || !publishedAt) continue;

    let canonicalUrl;
    try {
      const url = new URL(link, source.homepage);
      if (!/^https?:$/.test(url.protocol)) continue;
      url.hash = '';
      canonicalUrl = url.toString();
    } catch {
      continue;
    }

    const summaryText = strip(entry?.['content:encoded']?.['#text'] ?? entry?.['content:encoded'] ?? entry?.description?.['#text'] ?? entry?.description ?? '');
    const summary = summaryText.length > 420 ? `${summaryText.slice(0, 417).trimEnd()}…` : summaryText;
    const categories = arr(entry?.category).map(categoryText).filter(Boolean);
    const taggedTowns = source.authoritativeTownCategories
      ? BOROUGH_TOWNS.filter(town => categories.some(category => category.toLowerCase() === town.toLowerCase()))
      : [];
    const boroughWide = source.authoritativeTownCategories ? taggedTowns.length === 0 : source.boroughWide === true;
    const towns = source.authoritativeTownCategories ? (taggedTowns.length ? taggedTowns : BOROUGH_TOWNS) : source.towns;

    items.push({
      id: `${source.id}:${canonicalUrl}`,
      sourceId: source.id,
      source: source.name,
      sourceClass: source.sourceClass,
      sourceHomepage: source.homepage,
      mediaType: null,
      title,
      url: canonicalUrl,
      canonicalUrl,
      summary,
      publishedAt,
      towns,
      boroughWide,
      topics: topicGuess(`${title} ${summary} ${categories.join(' ')}`, source.defaultTopics),
      derived: false,
      aiGenerated: false
    });
  }

  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

function datedHtmlFallbackItems(source, html = '') {
  const items = new Map();
  const anchorRx = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRx.exec(html))) {
    let url;
    try {
      url = new URL(decodeEntities(match[1]), source.fallbackUrl || source.homepage);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, '') !== new URL(source.homepage).hostname.replace(/^www\./, '')) continue;
    const dateMatch = url.pathname.match(/^\/(20\d{2})\/(\d{2})\/(\d{2})\//);
    if (!dateMatch) continue;
    const title = strip(match[2]);
    if (title.length < 8 || title.length > 220 || /^(?:read more|older posts|newer posts|next|previous)$/i.test(title)) continue;
    const publishedAt = normaliseDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T12:00:00Z`);
    if (!publishedAt) continue;
    url.hash = '';
    const canonicalUrl = url.toString();
    const nearby = strip(html.slice(anchorRx.lastIndex, Math.min(html.length, anchorRx.lastIndex + 900)));
    const summary = nearby.length > 420 ? `${nearby.slice(0, 417).trimEnd()}…` : nearby;
    items.set(canonicalUrl, {
      id: `${source.id}:${canonicalUrl}`,
      sourceId: source.id,
      source: source.name,
      sourceClass: source.sourceClass,
      sourceHomepage: source.homepage,
      mediaType: null,
      title,
      url: canonicalUrl,
      canonicalUrl,
      summary,
      publishedAt,
      towns: source.towns,
      boroughWide: source.boroughWide === true,
      topics: topicGuess(`${title} ${summary}`, source.defaultTopics),
      derived: true,
      derivedFrom: 'Dated article link on the publisher’s public blog page',
      aiGenerated: false
    });
  }
  return [...items.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

async function fetchRssSource(source) {
  const started = Date.now();
  const diagnostics = [];
  let feedMessage = null;
  try {
    const { response, text } = await fetchText(source.url, 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5');
    diagnostics.push({ mode: 'rss', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started });
    if (response.ok) {
      const all = rssItems(source, text);
      if (all.length) {
        return {
          items: all.slice(0, 12),
          archiveItems: all.slice(0, 80),
          health: { id: source.id, name: source.name, homepage: source.homepage, ok: true, status: 'ok', error: null, itemCount: all.length, diagnostics }
        };
      }
      feedMessage = 'Feed responded but no dated entries were parsed';
    } else {
      feedMessage = `HTTP ${response.status}`;
    }
  } catch (error) {
    feedMessage = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    diagnostics.push({ mode: 'rss', outcome: 'transport-error', error: feedMessage, elapsedMs: Date.now() - started });
  }

  if (source.fallbackUrl) {
    const fallbackStarted = Date.now();
    try {
      const { response, text } = await fetchText(source.fallbackUrl);
      diagnostics.push({ mode: 'dated-blog-fallback', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - fallbackStarted });
      if (response.ok) {
        const all = datedHtmlFallbackItems(source, text);
        if (all.length) {
          return {
            items: all.slice(0, 12),
            archiveItems: all.slice(0, 80),
            health: { id: source.id, name: source.name, homepage: source.homepage, ok: true, status: 'ok', error: null, itemCount: all.length, diagnostics }
          };
        }
        feedMessage = `${feedMessage || 'Feed unavailable'}; fallback page contained no reliably dated article links`;
      } else {
        feedMessage = `${feedMessage || 'Feed unavailable'}; fallback HTTP ${response.status}`;
      }
    } catch (error) {
      const fallbackMessage = error?.name === 'AbortError' ? 'Fallback timed out' : String(error?.message || error);
      diagnostics.push({ mode: 'dated-blog-fallback', outcome: 'transport-error', error: fallbackMessage, elapsedMs: Date.now() - fallbackStarted });
      feedMessage = `${feedMessage || 'Feed unavailable'}; ${fallbackMessage}`;
    }
  }

  return {
    items: [],
    archiveItems: [],
    health: { id: source.id, name: source.name, homepage: source.homepage, ok: false, status: 'error', error: feedMessage || 'Source unavailable', itemCount: 0, diagnostics }
  };
}

function visionsDate(text = '') {
  const value = String(text);
  const range = value.match(/\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  if (range) return normaliseDate(`${range[1]} ${range[3]} ${range[4]} 12:00 UTC`);
  const full = value.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i);
  return full ? normaliseDate(`${full[1]} ${full[2]} ${full[3]} 12:00 UTC`) : null;
}

function visionsIdentityPart(title = '') {
  const slug = String(title)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
  return slug || 'entry';
}

function visionsItems(html = '') {
  const items = [];
  const rx = /<h3\b[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3\b|<h2\b|$)/gi;
  let match;
  while ((match = rx.exec(html))) {
    const title = strip(match[1]);
    const body = strip(match[2]);
    if (!title || body.length < 30) continue;
    const publishedAt = visionsDate(`${title} ${body}`);
    if (!publishedAt) continue;
    const identity = `${VISIONS.id}:${publishedAt.slice(0, 10)}:${visionsIdentityPart(title)}`;
    const summary = body.length > 420 ? `${body.slice(0, 417).trimEnd()}…` : body;
    items.push({
      id: identity,
      sourceId: VISIONS.id,
      source: VISIONS.name,
      sourceClass: VISIONS.sourceClass,
      sourceHomepage: VISIONS.homepage,
      mediaType: null,
      title,
      url: VISIONS.url,
      canonicalUrl: null,
      dedupeKey: identity,
      summary,
      publishedAt,
      towns: VISIONS.towns,
      topics: topicGuess(`${title} ${summary}`, VISIONS.defaultTopics),
      derived: true,
      derivedFrom: 'Dated item extracted from the official Visions for Northolt public news/resources page',
      aiGenerated: false
    });
  }
  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

async function fetchVisions() {
  const started = Date.now();
  try {
    const { response, text } = await fetchText(VISIONS.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const all = visionsItems(text);
    const recentCutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
    return {
      items: all.filter(item => Date.parse(item.publishedAt) >= recentCutoff).slice(0, 8),
      archiveItems: all.slice(0, 80),
      health: {
        id: VISIONS.id, name: VISIONS.name, homepage: VISIONS.homepage,
        ok: true, status: all.length ? 'ok' : 'empty',
        error: all.length ? null : 'Page responded but no reliably dated entries were parsed', itemCount: all.length,
        diagnostics: [{ mode: 'dated-public-page', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }]
      }
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return { items: [], archiveItems: [], health: { id: VISIONS.id, name: VISIONS.name, homepage: VISIONS.homepage, ok: false, status: 'error', error: message, itemCount: 0, diagnostics: [{ mode: 'dated-public-page', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] } };
  }
}

export async function fetchBoroughTownSources() {
  const results = await Promise.all([...RSS_SOURCES.map(fetchRssSource), fetchVisions()]);
  return {
    generatedAt: new Date().toISOString(),
    items: results.flatMap(result => result.items || []),
    archiveItems: results.flatMap(result => result.archiveItems || []),
    health: results.map(result => result.health)
  };
}

export default async () => {
  const data = await fetchBoroughTownSources();
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};