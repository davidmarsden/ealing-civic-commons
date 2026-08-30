const sources = [
  {
    id: 'ehcvs-ealing-news',
    name: 'Ealing and Hounslow CVS — Ealing news',
    url: 'https://ehcvs.org.uk/ealing-community-voluntary-services/',
    homepage: 'https://ehcvs.org.uk/ealing-community-voluntary-services/',
    sourceClass: 'Organisation / campaign',
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    defaultTopics: ['Community'],
    hostPattern: /^(?:www\.)?ehcvs\.org\.uk$/i,
    requireNearby: /Published\s+on/i,
    excludePath: /^\/(?:$|about|contact|services|projects|training|events|whats-on|ealing-community-voluntary-services\/?$)/i,
    dateStyle: 'published-on'
  },
  {
    id: 'warren-farm-nature-reserve-blog',
    name: 'Warren Farm Nature Reserve — Blog',
    url: 'https://www.warrenfarmnaturereserve.co.uk/blog',
    homepage: 'https://www.warrenfarmnaturereserve.co.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall', 'Hanwell'],
    defaultTopics: ['Environment', 'Planning & development'],
    hostPattern: /^(?:www\.)?warrenfarmnaturereserve\.co\.uk$/i,
    requireNearby: /\b\d{1,2}\/\d{1,2}\/\d{2}\b/,
    includePath: /^\/blog\/[a-z0-9][a-z0-9-]+\/?$/i,
    excludePath: /^\/blog\/?$/i,
    dateStyle: 'mdy-short'
  }
];

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…'
};

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
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

function strip(html = '') {
  return decodeEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(href, base) {
  try {
    const url = new URL(decodeEntities(href), base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function parsePublishedDate(text = '', source = {}) {
  const value = String(text);
  if (source.dateStyle === 'mdy-short') {
    const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
    if (!match) return null;
    const month = Number.parseInt(match[1], 10);
    const day = Number.parseInt(match[2], 10);
    const year = 2000 + Number.parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }

  const match = value.match(/Published\s+on\s*:?[\s\u00a0]*([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i);
  if (!match) return null;
  const timestamp = Date.parse(match[1]);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function removeDateText(text = '', source = {}) {
  if (source.dateStyle === 'mdy-short') return String(text).replace(/\b\d{1,2}\/\d{1,2}\/\d{2}\b/g, ' ');
  return String(text).replace(/Published\s+on\s*:?[\s\u00a0]*[0-3]?\d\s+[A-Za-z]+\s+20\d{2}/i, ' ');
}

function topicGuess(text, defaults = []) {
  const value = String(text || '').toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|hmo|licensing|housing scheme|regeneration|sports pitch/],
    ['Housing', /housing|tenant|rent|homeless|hmo/],
    ['Environment', /air quality|pollution|climate|green|park|tree|environment|recycling|waste|smoke-free|nature reserve|rewild|biodiversity|meadow|wildlife/],
    ['Transport', /traffic|transport|bus|rail|road|parking|cycle|heathrow/],
    ['Schools & young people', /school|children|young people|youth|education|nursery/],
    ['Policing & safety', /police|crime|safety|domestic abuse|violence|asb|antisocial|anti-social/],
    ['Council & democracy', /council|consultation|election|committee|scrutiny|petition|foi|freedom of information/],
    ['Public health', /health|vaccine|smoke-free|wellbeing|cancer|prostate/]
  ];
  return [...new Set([...rules.filter(([, rx]) => rx.test(value)).map(([name]) => name), ...defaults])].slice(0, 3);
}

function extractCards(source, html) {
  const results = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const url = absoluteUrl(match[1], source.url);
    if (!url || !source.hostPattern.test(url.hostname)) continue;
    if (source.includePath && !source.includePath.test(url.pathname)) continue;
    if (source.excludePath && source.excludePath.test(url.pathname)) continue;

    const title = strip(match[2]);
    if (title.length < 12 || title.length > 180) continue;
    if (/^(?:read more|learn more|find out more|back to news|news|events|projects)$/i.test(title)) continue;

    const windowStart = Math.max(0, match.index - 500);
    const windowEnd = Math.min(html.length, anchorPattern.lastIndex + 1300);
    const nearbyHtml = html.slice(windowStart, windowEnd);
    const nearbyText = strip(nearbyHtml);
    if (source.requireNearby && !source.requireNearby.test(nearbyText)) continue;

    const publishedAt = parsePublishedDate(nearbyText, source);
    if (!publishedAt) continue;

    let summary = removeDateText(nearbyText.replace(title, ' '), source)
      .replace(/\b(?:Written By|Read More|ongoing)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (summary.length > 420) summary = summary.slice(0, 417).trimEnd() + '…';

    results.push({
      id: `${source.id}:${url.href}`,
      sourceId: source.id,
      source: source.name,
      sourceClass: source.sourceClass,
      sourceHomepage: source.homepage,
      mediaType: null,
      title,
      url: url.href,
      canonicalUrl: url.href,
      summary,
      publishedAt,
      towns: source.towns,
      topics: topicGuess(`${title} ${summary}`, source.defaultTopics),
      derived: true,
      derivedFrom: 'Structured public news/blog listing'
    });
  }

  const unique = [...new Map(results.map(item => [item.canonicalUrl, item])).values()];
  return unique.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)).slice(0, 20);
}

async function fetchSource(source) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);
    let response;
    try {
      response = await fetch(source.url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'accept-language': 'en-GB,en;q=0.9',
          'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
        }
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const items = extractCards(source, html);
    return {
      items,
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: true,
        status: items.length ? 'ok' : 'empty',
        error: items.length ? null : 'Page fetched but no dated article cards matched the current extraction rules',
        itemCount: items.length,
        diagnostics: [{ mode: 'structured-page-watch', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }]
      }
    };
  } catch (error) {
    return {
      items: [],
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: false,
        status: 'error',
        error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error),
        itemCount: 0,
        diagnostics: [{ mode: 'structured-page-watch', outcome: 'transport-error', error: String(error?.message || error), elapsedMs: Date.now() - started }]
      }
    };
  }
}

export async function fetchCommunityPageFeed() {
  const results = await Promise.all(sources.map(fetchSource));
  return {
    generatedAt: new Date().toISOString(),
    items: results.flatMap(result => result.items),
    health: results.map(result => result.health)
  };
}

export default async () => {
  const data = await fetchCommunityPageFeed();
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
