const sources = [
  {
    id: 'warren-farm-nature-reserve-blog-rich',
    name: 'Warren Farm Nature Reserve — Blog',
    url: 'https://www.warrenfarmnaturereserve.co.uk/blog',
    homepage: 'https://www.warrenfarmnaturereserve.co.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall', 'Hanwell'],
    defaultTopics: ['Environment', 'Planning & development'],
    hostPattern: /^(?:www\.)?warrenfarmnaturereserve\.co\.uk$/i,
    includePath: /^\/blog\/[a-z0-9][a-z0-9-]+\/?$/i,
    dateStyle: 'mdy-short',
    currentLimit: 6,
    archiveLimit: 30
  },
  {
    id: 'southall-black-sisters-news',
    name: 'Southall Black Sisters — News',
    url: 'https://southallblacksisters.org.uk/news/',
    homepage: 'https://southallblacksisters.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall'],
    defaultTopics: ['Community'],
    hostPattern: /^(?:www\.)?southallblacksisters\.org\.uk$/i,
    includePath: /^\/news\/[a-z0-9][a-z0-9-]+\/?$/i,
    dateStyle: 'dmy-text',
    currentLimit: 6,
    archiveLimit: 30
  },
  {
    id: 'southall-black-sisters-campaigns',
    name: 'Southall Black Sisters — Submissions & campaigns',
    url: 'https://southallblacksisters.org.uk/submissions-campaigns/',
    homepage: 'https://southallblacksisters.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall'],
    defaultTopics: ['Community', 'Council & democracy'],
    hostPattern: /^(?:www\.)?southallblacksisters\.org\.uk$/i,
    includePath: /^\/submissions-campaigns\/[a-z0-9][a-z0-9-]+\/?$/i,
    dateStyle: 'dmy-text',
    currentLimit: 6,
    archiveLimit: 30
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
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url;
  } catch {
    return null;
  }
}

function parseDate(text = '', style) {
  const value = String(text);
  if (style === 'mdy-short') {
    const match = value.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/);
    if (!match) return null;
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = 2000 + Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }
  if (style === 'dmy-text') {
    const match = value.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*,?\s*(20\d{2})\b/i);
    if (!match) return null;
    const timestamp = Date.parse(`${match[1]} ${match[2]} ${match[3]}`);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }
  return null;
}

function topicGuess(text, defaults = []) {
  const value = String(text || '').toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|sports pitch|local plan|nature reserve/],
    ['Housing', /housing|social housing|tenant|rent|homeless|refuge/],
    ['Environment', /pollution|climate|green space|park|tree|nature|rewild|biodiversity|wildlife|skylark|meadow/],
    ['Policing & safety', /police|crime|domestic abuse|violence|safety|hate crime|racis/],
    ['Council & democracy', /council|consultation|election|committee|scrutiny|petition|government|strategy|submission|accountability/],
    ['Public health', /public health|health|wellbeing|violence against women|vawg/]
  ];
  return [...new Set([...rules.filter(([, rx]) => rx.test(value)).map(([topic]) => topic), ...defaults])].slice(0, 3);
}

function extractItems(source, html) {
  const anchors = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const url = absoluteUrl(match[1], source.url);
    if (!url || !source.hostPattern.test(url.hostname) || !source.includePath.test(url.pathname)) continue;
    const title = strip(match[2]);
    if (title.length < 12 || title.length > 220 || /^(?:read more|learn more|news|campaigns)$/i.test(title)) continue;
    const nearby = strip(html.slice(Math.max(0, match.index - 650), Math.min(html.length, pattern.lastIndex + 900)));
    const publishedAt = parseDate(nearby, source.dateStyle);
    if (!publishedAt) continue;
    let summary = nearby.replace(title, ' ').replace(/\s+/g, ' ').trim();
    if (summary.length > 420) summary = `${summary.slice(0, 417).trimEnd()}…`;
    anchors.push({
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
      derivedFrom: 'Structured public archive/listing page'
    });
  }
  const unique = [...new Map(anchors.map(item => [item.canonicalUrl, item])).values()];
  return unique.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)).slice(0, source.archiveLimit || 30);
}

async function fetchSource(source) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(source.url, {
        signal: controller.signal,
        redirect: 'follow',
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
    const archiveItems = extractItems(source, await response.text());
    return {
      items: archiveItems.slice(0, source.currentLimit || 6),
      archiveItems,
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: true,
        status: archiveItems.length ? 'ok' : 'empty',
        error: archiveItems.length ? null : 'Page fetched but no dated rich-source entries matched the configured structure',
        itemCount: archiveItems.length,
        diagnostics: [{ mode: 'rich-source-structured-archive', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }]
      }
    };
  } catch (error) {
    return {
      items: [],
      archiveItems: [],
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: false,
        status: 'error',
        error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error),
        itemCount: 0,
        diagnostics: [{ mode: 'rich-source-structured-archive', outcome: 'transport-error', error: String(error?.message || error), elapsedMs: Date.now() - started }]
      }
    };
  }
}

export async function fetchRichSourceFeed() {
  const results = await Promise.all(sources.map(fetchSource));
  return {
    generatedAt: new Date().toISOString(),
    items: results.flatMap(result => result.items),
    archiveItems: results.flatMap(result => result.archiveItems),
    health: results.map(result => result.health)
  };
}

export default async () => {
  const data = await fetchRichSourceFeed();
  return new Response(JSON.stringify({ generatedAt: data.generatedAt, items: data.items, health: data.health }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
