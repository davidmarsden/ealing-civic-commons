import { XMLParser } from 'fast-xml-parser';

const sources = [
  {
    id: 'gla-assembly-press-releases',
    name: 'London Assembly — Press releases',
    url: 'https://www.london.gov.uk/rss-feeds/80611',
    homepage: 'https://www.london.gov.uk/who-we-are/what-london-assembly-does/london-assembly-press-releases',
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'gla-assembly-investigations',
    name: 'London Assembly — Current investigations',
    url: 'https://www.london.gov.uk/rss-feeds/80616',
    homepage: 'https://www.london.gov.uk/current-investigations',
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'gla-assembly-publications',
    name: 'London Assembly — Publications',
    url: 'https://www.london.gov.uk/rss-feeds/80633',
    homepage: 'https://www.london.gov.uk/assembly-publications',
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'gla-housing-land-publications',
    name: 'City Hall — Housing and land publications',
    url: 'https://www.london.gov.uk/rss-feeds/80642',
    homepage: 'https://www.london.gov.uk/programmes-strategies/housing-and-land',
    defaultTopics: ['Housing', 'Planning & development']
  },
  {
    id: 'gla-planning-publications',
    name: 'City Hall — Planning publications',
    url: 'https://www.london.gov.uk/rss-feeds/80643',
    homepage: 'https://www.london.gov.uk/programmes-strategies/planning',
    defaultTopics: ['Planning & development']
  },
  {
    id: 'gla-environment-publications',
    name: 'City Hall — Environment and climate publications',
    url: 'https://www.london.gov.uk/rss-feeds/80644',
    homepage: 'https://www.london.gov.uk/programmes-strategies/environment-and-climate-change',
    defaultTopics: ['Environment']
  }
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const textValue = value => value?.['#text'] ?? value ?? '';

const LOCAL_TERMS = [
  'Ealing', 'Southall', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale',
  'Ealing & Hillingdon', 'Ealing and Hillingdon', 'Bassam Mahfouz',
  'Heathrow', 'Old Oak', 'OPDC', 'Old Oak and Park Royal',
  'Warren Farm', 'Green Quarter', 'Southall Gasworks'
];

const strip = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&rsquo;/gi, '’')
  .replace(/\s+/g, ' ')
  .trim();

function linkValue(link) {
  if (typeof link === 'string') return link;
  if (Array.isArray(link)) return link.find(item => item?.['@_rel'] === 'alternate')?.['@_href'] || link[0]?.['@_href'] || null;
  return link?.['@_href'] || null;
}

function normaliseDate(value) {
  const stamp = Date.parse(String(value || ''));
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}

function isEalingRelevant(text) {
  const haystack = String(text || '').toLowerCase();
  return LOCAL_TERMS.some(term => haystack.includes(term.toLowerCase()));
}

function topicGuess(text, defaults) {
  const value = String(text || '').toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|housing delivery|land|opdc|old oak/],
    ['Housing', /housing|rent|tenant|homeless|rough sleeping|affordable home|empty homes/],
    ['Environment', /environment|climate|air quality|pollution|green space|fly.?tipping|waste|heatwave|heathrow/],
    ['Transport', /transport|bus|rail|road|heathrow|traffic|cycle|tfl/],
    ['Policing & safety', /police|metropolitan police|mopac|crime|fire safety/],
    ['Council & democracy', /assembly|committee|mayor|scrutiny|investigation|consultation/]
  ];
  const hits = rules.filter(([, rx]) => rx.test(value)).map(([name]) => name);
  return [...new Set([...hits, ...defaults])].slice(0, 3);
}

function normaliseItem(source, item) {
  const title = strip(textValue(item.title) || 'Untitled');
  const description = strip(textValue(item.description ?? item.summary ?? item['content:encoded'] ?? item.content));
  const link = linkValue(item.link) || source.homepage;
  const published = item.pubDate ?? item.published ?? item.updated ?? item.date ?? null;
  const combined = `${title} ${description}`;
  if (!isEalingRelevant(combined)) return null;

  return {
    id: `${source.id}:${textValue(item.guid) || textValue(item.id) || link || title}`,
    sourceId: source.id,
    source: source.name,
    sourceClass: 'Official record',
    sourceHomepage: source.homepage,
    mediaType: null,
    title,
    url: link,
    canonicalUrl: link,
    summary: description.slice(0, 420),
    publishedAt: normaliseDate(published),
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    topics: topicGuess(combined, source.defaultTopics),
    derived: true,
    derivedFrom: 'City Hall RSS filtered for Ealing-area relevance'
  };
}

async function fetchSource(source) {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7500);
    let response;
    try {
      response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
          'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
        }
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parser.parse(await response.text());
    const rawItems = parsed?.rss?.channel ? arr(parsed.rss.channel.item) : arr(parsed?.feed?.entry);
    const items = rawItems.slice(0, 30).map(item => normaliseItem(source, item)).filter(Boolean).slice(0, 8);
    return { source, ok: true, status: 'ok', items, diagnostics: [{ mode: 'civic-reader', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - startedAt }] };
  } catch (error) {
    return { source, ok: false, status: 'error', error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error), items: [], diagnostics: [{ mode: 'civic-reader', outcome: 'error', elapsedMs: Date.now() - startedAt }] };
  }
}

export async function fetchGlaFeed() {
  const results = await Promise.all(sources.map(fetchSource));
  const seen = new Set();
  const items = results.flatMap(result => result.items).filter(item => {
    const key = item.canonicalUrl || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)).slice(0, 24);

  const health = results.map(result => ({
    id: result.source.id,
    name: result.source.name,
    homepage: result.source.homepage,
    ok: result.ok,
    status: result.status,
    error: result.error || null,
    itemCount: result.items.length,
    diagnostics: result.diagnostics
  }));

  return { generatedAt: new Date().toISOString(), items, health };
}

export default async () => new Response(JSON.stringify(await fetchGlaFeed()), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, stale-while-revalidate=900',
    'access-control-allow-origin': '*'
  }
});
