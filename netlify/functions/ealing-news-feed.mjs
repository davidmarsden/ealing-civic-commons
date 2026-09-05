import { XMLParser } from 'fast-xml-parser';

const HOME = 'https://www.ealing.news/';
const FEED = 'https://www.ealing.news/feed/';
const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];

const entities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
  hellip: '…', pound: '£'
};

function decode(value = '') {
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

const strip = value => decode(String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const textValue = value => value?.['#text'] ?? value ?? '';

function normaliseDate(value) {
  const timestamp = Date.parse(String(value || ''));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function canonical(value) {
  try {
    const url = new URL(String(value || ''), HOME);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (url.hostname.replace(/^www\./, '') !== 'ealing.news') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function categories(entry) {
  return arr(entry?.category).map(value => strip(textValue(value))).filter(Boolean);
}

function townTags(text = '', cats = []) {
  const haystack = `${text} ${cats.join(' ')}`.toLowerCase();
  const towns = BOROUGH_TOWNS.filter(town => new RegExp(`\\b${town.toLowerCase()}\\b`, 'i').test(haystack));
  return towns.length ? towns : BOROUGH_TOWNS;
}

function topicGuess(text = '', cats = []) {
  const value = `${text} ${cats.join(' ')}`.toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|construction|application|local plan|tower|redevelop|section 106/],
    ['Housing', /housing|homes|tenant|landlord|rent|homeless|hmo|social rent|temporary accommodation/],
    ['Environment', /environment|climate|pollution|air quality|biodiversity|park|tree|wildlife|waste|recycling|fly-tipping|canal|river/],
    ['Transport', /transport|traffic|bus|rail|station|road|parking|cycle|elizabeth line|central line|piccadilly line|tfl/],
    ['Schools & young people', /school|education|children|young people|youth|college|university|breakfast club/],
    ['Policing & safety', /police|crime|antisocial|anti-social|safety|arrest|convicted|court|robbery|assault/],
    ['Culture & history', /heritage|culture|arts|museum|library|theatre|conservation/],
    ['Council & democracy', /ealing council|council|councillor|cabinet|committee|scrutiny|ombudsman|election|consultation|petition|local authority|ward|mayor/],
    ['Public health', /public health|health|nhs|care|hospital|frailty|disability|wellbeing/]
  ];
  return [...new Set(rules.filter(([, rx]) => rx.test(value)).map(([name]) => name))].slice(0, 3);
}

const ALWAYS_INCLUDE_CATEGORIES = new Set([
  'Ealing Council',
  'Homes & Property',
  'Environment',
  'Education',
  'Health & Wellbeing',
  'Youth',
  'Politics',
  'Ealing Council Elections 2026'
].map(value => value.toLowerCase()));

const SOFT_CATEGORIES = new Set([
  'Sport', 'Food & Drink', 'Arts & Culture', 'Entertainment', 'What’s On', "What's On"
].map(value => value.toLowerCase()));

const CIVIC_TERMS = /\b(?:ealing council|council(?:lor|lors)?|cabinet|committee|scrutiny|ombudsman|planning|development|regeneration|housing|homes|tenant|landlord|rent|homeless|hmo|consultation|election|ward|public health|nhs|school|education|police|crime|transport|traffic|road|rail|station|bus|parking|cycle|environment|pollution|air quality|climate|biodiversity|park|tree|waste|recycling|fly-tipping|heritage|conservation|library|community centre|public realm|licen[cs]ing|minimum wage|social care|foster care)\b/i;

const PROMO_TERMS = /\b(?:what'?s on|wine tasting|restaurant review|match report|fixture|transfer|recipe|gig guide|festival of business|awards entries?|competition|giveaway)\b/i;

function isCivicRelevant(title, summary, cats) {
  const lowerCats = cats.map(value => value.toLowerCase());
  if (lowerCats.some(value => ALWAYS_INCLUDE_CATEGORIES.has(value))) return true;

  const text = `${title} ${summary}`;
  if (CIVIC_TERMS.test(text)) return true;

  // Crime and Community can be valuable, but only when the article itself has a
  // clear civic/public-interest signal. Routine incidents and event listings do
  // not enter merely because of a broad publisher category.
  if (lowerCats.includes('crime') || lowerCats.includes('community') || lowerCats.includes('business')) {
    return CIVIC_TERMS.test(text) && !PROMO_TERMS.test(text);
  }

  if (lowerCats.some(value => SOFT_CATEGORIES.has(value))) return false;
  return false;
}

function opinionFlag(cats = [], title = '') {
  return cats.some(value => value.toLowerCase() === 'opinion') || /^opinion\s*:/i.test(title);
}

async function fetchXml() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(FEED, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { xml: await response.text(), status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

function parseFeed(xml = '') {
  const parsed = parser.parse(xml);
  const entries = arr(parsed?.rss?.channel?.item);
  const items = [];

  for (const entry of entries) {
    const title = strip(textValue(entry?.title));
    const url = canonical(textValue(entry?.link));
    const publishedAt = normaliseDate(textValue(entry?.pubDate) || textValue(entry?.['dc:date']));
    if (!title || !url || !publishedAt) continue;

    const rawSummary = textValue(entry?.['content:encoded']) || textValue(entry?.description);
    const summaryText = strip(rawSummary);
    const summary = summaryText.length > 420 ? `${summaryText.slice(0, 417).trimEnd()}…` : summaryText;
    const cats = categories(entry);
    if (!isCivicRelevant(title, summary, cats)) continue;

    const text = `${title} ${summary}`;
    const towns = townTags(text, cats);
    const isOpinion = opinionFlag(cats, title);

    items.push({
      id: `ealing-news:${url}`,
      sourceId: 'ealing-news',
      source: 'EALING.NEWS',
      sourceClass: 'Journalism / publishing',
      sourceHomepage: HOME,
      mediaType: null,
      title,
      url,
      canonicalUrl: url,
      summary,
      publishedAt,
      towns,
      boroughWide: towns.length === BOROUGH_TOWNS.length,
      topics: topicGuess(text, cats),
      derived: false,
      aiGenerated: false,
      contentLabel: isOpinion ? 'Opinion' : null,
      publisherCategories: cats
    });
  }

  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export async function fetchEalingNewsFeed() {
  const started = Date.now();
  try {
    const { xml, status } = await fetchXml();
    const all = parseFeed(xml);
    return {
      generatedAt: new Date().toISOString(),
      items: all.slice(0, 30),
      archiveItems: all.slice(0, 100),
      health: [{
        id: 'ealing-news',
        name: 'EALING.NEWS',
        homepage: HOME,
        ok: true,
        status: all.length ? 'ok' : 'empty',
        itemCount: all.length,
        error: all.length ? null : 'Feed fetched but no current entries passed the civic-interest filter',
        diagnostics: [{ mode: 'filtered-rss', outcome: 'http-response', httpStatus: status, elapsedMs: Date.now() - started }]
      }]
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      archiveItems: [],
      health: [{
        id: 'ealing-news',
        name: 'EALING.NEWS',
        homepage: HOME,
        ok: false,
        status: 'error',
        itemCount: 0,
        error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error)
      }]
    };
  }
}

export const _test = { parseFeed, isCivicRelevant, topicGuess, townTags, opinionFlag };

export default async () => new Response(JSON.stringify(await fetchEalingNewsFeed()), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, stale-while-revalidate=900',
    'access-control-allow-origin': '*'
  }
});
