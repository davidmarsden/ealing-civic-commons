const sources = [
  {
    id: 'warren-farm-nature-reserve-blog',
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
    archiveLimit: 100,
    maxPages: 1
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
    archiveLimit: 500,
    maxPages: 40,
    paginated: true
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
    archiveLimit: 500,
    maxPages: 40,
    paginated: true
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

function safeHtmlWindow(html, rawStart, rawEnd) {
  let start = Math.max(0, rawStart);
  let end = Math.min(html.length, rawEnd);

  // A character-count window can begin or end halfway through a tag. If that
  // fragment is handed to strip(), orphaned attributes such as srcset/data-src
  // become visible text. Move both edges outside any partial tag first.
  const openBeforeStart = html.lastIndexOf('<', start);
  const closeBeforeStart = html.lastIndexOf('>', start);
  if (openBeforeStart > closeBeforeStart) {
    const closeAfterStart = html.indexOf('>', start);
    if (closeAfterStart !== -1 && closeAfterStart < end) start = closeAfterStart + 1;
  }

  const openBeforeEnd = html.lastIndexOf('<', end);
  const closeBeforeEnd = html.lastIndexOf('>', end);
  if (openBeforeEnd > closeBeforeEnd && openBeforeEnd > start) end = openBeforeEnd;

  return html.slice(start, end);
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

function extractItems(source, html, baseUrl = source.url) {
  const anchors = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const url = absoluteUrl(match[1], baseUrl);
    if (!url || !source.hostPattern.test(url.hostname) || !source.includePath.test(url.pathname)) continue;
    const title = strip(match[2]);
    if (title.length < 12 || title.length > 220 || /^(?:read more|learn more|news|campaigns)$/i.test(title)) continue;
    const nearbyHtml = safeHtmlWindow(html, match.index - 650, pattern.lastIndex + 900);
    const nearby = strip(nearbyHtml);
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
  return anchors;
}

function pageUrl(source, page) {
  if (page <= 1 || !source.paginated) return source.url;
  const url = new URL(source.url);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/page/${page}/`;
  return url.href;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    return { response, html: response.ok ? await response.text() : null };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSource(source, { deep = false } = {}) {
  const started = Date.now();
  const allItems = new Map();
  let pagesFetched = 0;
  let lastHttpStatus = null;
  const pageLimit = deep ? (source.maxPages || 1) : 1;

  try {
    for (let page = 1; page <= pageLimit; page += 1) {
      const url = pageUrl(source, page);
      const { response, html } = await fetchHtml(url);
      lastHttpStatus = response.status;

      if (page > 1 && response.status === 404) break;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      pagesFetched += 1;
      const pageItems = extractItems(source, html, url);
      const before = allItems.size;
      pageItems.forEach(item => allItems.set(item.canonicalUrl, item));

      if (deep && source.paginated && page > 1 && allItems.size === before) break;
      if (!deep || !source.paginated) break;
    }

    const archiveItems = [...allItems.values()]
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
      .slice(0, deep ? (source.archiveLimit || 100) : (source.currentLimit || 6));

    return {
      items: archiveItems.slice(0, source.currentLimit || 6),
      archiveItems,
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: true,
        status: archiveItems.length ? 'ok' : 'empty',
        error: archiveItems.length ? null : 'Pages fetched but no dated rich-source entries matched the configured structure',
        itemCount: archiveItems.length,
        diagnostics: [{
          mode: deep ? 'rich-source-deep-archive' : 'rich-source-live',
          outcome: 'http-response',
          httpStatus: lastHttpStatus,
          pagesFetched,
          elapsedMs: Date.now() - started
        }]
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
        diagnostics: [{
          mode: deep ? 'rich-source-deep-archive' : 'rich-source-live',
          outcome: 'transport-error',
          error: String(error?.message || error),
          pagesFetched,
          elapsedMs: Date.now() - started
        }]
      }
    };
  }
}

export async function fetchRichSourceFeed(options = {}) {
  const results = await Promise.all(sources.map(source => fetchSource(source, options)));
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
