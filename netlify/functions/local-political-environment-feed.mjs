import { createHash } from 'node:crypto';

const TOWNS = ['Acton', 'Ealing', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];

const sources = [
  {
    id: 'lager-can-blog',
    name: 'LAGER Can — Blog',
    url: 'https://lagercan.co.uk/blog/',
    homepage: 'https://lagercan.co.uk/',
    sourceClass: 'Organisation / campaign',
    contentLabel: 'Environmental community organisation',
    type: 'lager',
    articlePattern: /^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/i,
    defaultTopics: ['Environment', 'Community']
  },
  {
    id: 'ealing-labour-news',
    name: 'Ealing Labour — News',
    url: 'https://www.ealinglabour.co.uk/',
    homepage: 'https://www.ealinglabour.co.uk/',
    sourceClass: 'Political organisation / campaign',
    contentLabel: 'Party political publishing',
    type: 'political',
    articlePattern: /^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/i,
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'ealing-conservatives-news',
    name: 'Ealing Conservatives — News',
    url: 'https://www.ealingconservatives.org.uk/representing-you',
    homepage: 'https://www.ealingconservatives.org.uk/',
    sourceClass: 'Political organisation / campaign',
    contentLabel: 'Party political publishing',
    type: 'political',
    articlePattern: /^\/news\/[a-z0-9-]+\/?$/i,
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'ealing-green-party-news',
    name: 'Ealing Green Party — News',
    url: 'https://ealing.greenparty.org.uk/news/',
    homepage: 'https://ealing.greenparty.org.uk/',
    sourceClass: 'Political organisation / campaign',
    contentLabel: 'Party political publishing',
    type: 'political',
    articlePattern: /^\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/?$/i,
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'ealing-libdems-news',
    name: 'Ealing Liberal Democrats — News',
    url: 'https://www.ealinglibdems.org.uk/',
    homepage: 'https://www.ealinglibdems.org.uk/',
    sourceClass: 'Political organisation / campaign',
    contentLabel: 'Party political publishing',
    type: 'political',
    articlePattern: /^\/news\/article\/[a-z0-9-]+\/?$/i,
    defaultTopics: ['Council & democracy']
  }
];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };

function decode(value = '') {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (m, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (m, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => entities[name.toLowerCase()] ?? m);
}

function strip(value = '') {
  return decode(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function absoluteUrl(href, base) {
  try {
    const url = new URL(decode(href), base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function sameHost(a, b) {
  return a.replace(/^www\./i, '').toLowerCase() === b.replace(/^www\./i, '').toLowerCase();
}

function normaliseDate(raw) {
  const stamp = Date.parse(String(raw || '').replace(/(\d)(st|nd|rd|th)/i, '$1'));
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}

function parseDate(text = '') {
  const patterns = [
    /\b([0-3]?\d(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})\b/i,
    /\b([A-Za-z]+\s+[0-3]?\d,\s+20\d{2})\b/i,
    /\b(20\d{2}-\d{2}-\d{2})\b/
  ];
  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (!match) continue;
    const date = normaliseDate(match[1]);
    if (date) return date;
  }
  return null;
}

function pathDate(pathname = '') {
  const match = String(pathname).match(/^\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  return match ? normaliseDate(`${match[1]}-${match[2]}-${match[3]}`) : null;
}

function metaContent(html = '', key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = String(html).match(pattern);
    if (match) return decode(match[1]).trim();
  }
  return '';
}

function structuredPublishedDate(html = '') {
  const candidates = [
    metaContent(html, 'article:published_time'),
    metaContent(html, 'date'),
    metaContent(html, 'datePublished')
  ].filter(Boolean);

  const time = String(html).match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1];
  if (time) candidates.push(time);

  for (const match of String(html).matchAll(/["']datePublished["']\s*:\s*["']([^"']+)["']/gi)) candidates.push(match[1]);

  for (const candidate of candidates) {
    const date = normaliseDate(candidate);
    if (date) return date;
  }
  return null;
}

function articleContent(html = '') {
  const description = metaContent(html, 'description') || metaContent(html, 'og:description');
  const article = String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main = String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const body = strip(article || main || '');
  const summary = strip(description);
  return {
    text: body || summary,
    summary: summary || body.slice(0, 700)
  };
}

function inferPlaceScope(text = '') {
  const value = String(text);
  const towns = TOWNS.filter(town => new RegExp(`(^|[^A-Za-z])${town}([^A-Za-z]|$)`, 'i').test(value));
  return { towns, boroughWide: towns.length === 0 };
}

function inferTopics(text = '', defaults = []) {
  const value = String(text).toLowerCase();
  const rules = [
    ['Council & democracy', /council|councillor|cabinet|committee|election|manifesto|budget|scrutiny|consultation|ward|mayor/],
    ['Planning & development', /planning|development|regeneration|tower|housing scheme|co-living|hmo|land|golf club/],
    ['Housing', /housing|rent|tenant|landlord|homeless|affordable|social rent|hmo/],
    ['Environment', /environment|climate|litter|fly.?tip|waste|recycling|river|park|green space|nature|biodiversity|pollution|air quality/],
    ['Transport', /transport|traffic|bus|rail|road|parking|cycle|tfl|heathrow/],
    ['Schools & young people', /school|education|children|young people|youth|ofsted|safeguard/],
    ['Policing & safety', /police|crime|antisocial|anti-social|safety|cctv|violence/],
    ['Public health', /health|nhs|hospital|social care|wellbeing/],
    ['Community', /community|volunteer|residents|neighbourhood|festival|interfaith/]
  ];
  const inferred = rules.filter(([, rx]) => rx.test(value)).map(([topic]) => topic);
  return [...new Set([...inferred, ...defaults])].slice(0, 4);
}

function isNavigationalTitle(title = '') {
  return /^(?:read more|view|news|latest|blog|campaigns|our plan|our team|join|donate|events?)$/i.test(title.trim());
}

function extractListing(source, html) {
  const links = [];
  const rx = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = rx.exec(html))) {
    const url = absoluteUrl(match[1], source.url);
    if (!url || !sameHost(url.hostname, new URL(source.url).hostname) || !source.articlePattern.test(url.pathname)) continue;
    const title = strip(match[2]);
    if (title.length < 10 || title.length > 220 || isNavigationalTitle(title)) continue;
    const start = Math.max(0, match.index - 350);
    const end = Math.min(html.length, rx.lastIndex + 500);
    const nearby = strip(html.slice(start, end));
    links.push({ url: url.href, title, nearby, publishedAt: pathDate(url.pathname) });
  }
  return [...new Map(links.map(item => [item.url, item])).values()].slice(0, 20);
}

async function enrich(source, entry) {
  let articleText = '';
  let summary = '';
  let publishedAt = entry.publishedAt;

  try {
    const html = await fetchHtml(entry.url);
    const scoped = articleContent(html);
    articleText = scoped.text;
    summary = scoped.summary;
    publishedAt = structuredPublishedDate(html) || parseDate(articleText) || publishedAt;
  } catch {
    // Fall back only to the listing excerpt and a date encoded in the article URL.
    articleText = entry.nearby;
    summary = entry.nearby;
  }

  if (!publishedAt) return null;

  const contentText = `${entry.title} ${articleText || summary}`.trim();
  const placeScope = inferPlaceScope(contentText);
  const hash = createHash('sha256').update(entry.url).digest('hex').slice(0, 16);
  const cleanSummary = String(summary || articleText || '')
    .replace(entry.title, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);

  return {
    id: `${source.id}:${hash}`,
    sourceId: source.id,
    source: source.name,
    sourceClass: source.sourceClass,
    sourceHomepage: source.homepage,
    mediaType: null,
    contentLabel: source.contentLabel,
    title: entry.title,
    url: entry.url,
    canonicalUrl: entry.url,
    summary: cleanSummary,
    publishedAt,
    towns: placeScope.towns,
    boroughWide: placeScope.boroughWide,
    topics: inferTopics(contentText, source.defaultTopics),
    derived: true,
    derivedFrom: source.type === 'political'
      ? 'First-party local party news/publication page; political claims remain attributable to the publisher'
      : 'First-party organisation blog page; article links and publisher dates extracted conservatively'
  };
}

async function fetchSource(source) {
  const html = await fetchHtml(source.url);
  const entries = extractListing(source, html);
  const items = (await Promise.all(entries.map(entry => enrich(source, entry)))).filter(Boolean);
  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 12);
}

export async function fetchLocalPoliticalEnvironmentFeed() {
  const results = await Promise.allSettled(sources.map(async source => ({ source, items: await fetchSource(source) })));
  const items = [];
  const health = [];

  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === 'fulfilled') {
      items.push(...result.value.items);
      health.push({
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: true,
        status: result.value.items.length ? 'ok' : 'empty',
        itemCount: result.value.items.length,
        error: result.value.items.length ? null : 'Source page fetched but no safely dated article links matched the configured publication pattern'
      });
    } else {
      health.push({ id: source.id, name: source.name, homepage: source.homepage, ok: false, status: 'error', itemCount: 0, error: String(result.reason?.message || result.reason) });
    }
  });

  return { generatedAt: new Date().toISOString(), items, health };
}

export default async () => new Response(JSON.stringify(await fetchLocalPoliticalEnvironmentFeed()), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=900, stale-while-revalidate=1800',
    'access-control-allow-origin': '*'
  }
});
