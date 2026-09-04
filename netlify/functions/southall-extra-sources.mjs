import { XMLParser } from 'fast-xml-parser';

const RSS_SOURCES = [
  {
    id: 'southall-speaks',
    name: 'Southall Speaks',
    url: 'https://atterkalsi.substack.com/feed',
    homepage: 'https://atterkalsi.substack.com/',
    sourceClass: 'Journalism / publishing',
    towns: ['Southall'],
    defaultTopics: ['Community', 'Culture & history']
  },
  {
    id: 'vicious-ealing-council',
    name: 'Vicious Ealing Council',
    url: 'https://vicious-ealing-council.co.uk/feed/',
    homepage: 'https://vicious-ealing-council.co.uk/',
    sourceClass: 'Independent civic commentary',
    towns: ['Ealing'],
    defaultTopics: ['Council & democracy']
  }
];

const VISIT_SOUTHALL = {
  id: 'visit-southall-news',
  name: 'Visit Southall — News',
  homepage: 'https://www.visitsouthall.co.uk/',
  currentUrl: 'https://www.visitsouthall.co.uk/News/News.php',
  archiveUrl: 'https://www.visitsouthall.co.uk/News/NewsArchive.php',
  sourceClass: 'Journalism / publishing',
  towns: ['Southall'],
  defaultTopics: ['Community']
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', pound: '£'
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

function normaliseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function topicGuess(text = '', defaults = []) {
  const value = String(text).toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|tower|construction|application|industrial site/],
    ['Housing', /housing|tenant|rent|homeless|homebuilding|social care home/],
    ['Environment', /air quality|pollution|climate|park|tree|environment|waste|fly-tipping|fireworks|ghee/],
    ['Transport', /traffic|transport|bus|rail|road|parking|cycle|elizabeth line/],
    ['Schools & young people', /school|children|young people|youth|education|college|student/],
    ['Policing & safety', /police|crime|arrest|weapon|safety|antisocial|anti-social|licen[cs]/],
    ['Culture & history', /history|heritage|arts|culture|music|exhibition|bussing|bhangra|film|festival/],
    ['Council & democracy', /council|cabinet|committee|scrutiny|election|petition|consultation|ombudsman|complaint|local authority/],
    ['Public health', /public health|health|social care|care act|disability|stroke/]
  ];
  return [...new Set([...rules.filter(([, rx]) => rx.test(value)).map(([name]) => name), ...defaults])].slice(0, 3);
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept,
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    return { response, text: response.ok ? await response.text() : '' };
  } finally {
    clearTimeout(timer);
  }
}

function rssItems(source, xml = '') {
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  const entries = arr(channel?.item);
  const items = [];

  for (const entry of entries) {
    const title = strip(entry?.title?.['#text'] ?? entry?.title ?? '');
    const link = String(entry?.link?.['#text'] ?? entry?.link ?? '').trim();
    const publishedAt = normaliseDate(entry?.pubDate?.['#text'] ?? entry?.pubDate ?? entry?.['dc:date'] ?? null);
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

    const rawSummary = entry?.['content:encoded']?.['#text'] ?? entry?.['content:encoded'] ?? entry?.description?.['#text'] ?? entry?.description ?? '';
    const summaryText = strip(rawSummary);
    const summary = summaryText.length > 420 ? `${summaryText.slice(0, 417).trimEnd()}…` : summaryText;

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
      towns: source.towns,
      topics: topicGuess(`${title} ${summary}`, source.defaultTopics),
      derived: false,
      aiGenerated: false
    });
  }

  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

function absoluteVisitSouthallUrl(href) {
  try {
    const url = new URL(decodeEntities(href), VISIT_SOUTHALL.currentUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!/^(?:www\.)?visitsouthall\.co\.uk$/i.test(url.hostname)) return null;
    if (!/^\/News\/NewsDetails\.php$/i.test(url.pathname)) return null;
    if (!/^\d+$/.test(url.searchParams.get('recordID') || '')) return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function visitSouthallDate(text = '') {
  const match = String(text).match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);
  return match ? normaliseDate(`${match[1]} ${match[2]} ${match[3]} 12:00 UTC`) : null;
}

function extractVisitSouthallItems(html = '', baseUrl = VISIT_SOUTHALL.currentUrl) {
  const items = new Map();
  const anchorRx = /<a\b[^>]*href=["']([^"']*NewsDetails\.php\?[^"']*recordID=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRx.exec(html))) {
    const url = absoluteVisitSouthallUrl(match[1]);
    if (!url) continue;
    const title = strip(match[2]);
    if (!title || title.length < 8 || /^image$/i.test(title)) continue;

    const nearbyStart = Math.max(0, match.index - 160);
    const nearbyEnd = Math.min(html.length, anchorRx.lastIndex + 650);
    const nearby = strip(html.slice(nearbyStart, nearbyEnd));
    const publishedAt = visitSouthallDate(nearby);
    if (!publishedAt) continue;

    const id = `${VISIT_SOUTHALL.id}:${url.searchParams.get('recordID')}`;
    let summary = nearby.replace(title, '').replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*\d{1,2}\s+[A-Za-z]+\s+20\d{2}\s*/i, '').trim();
    summary = summary.replace(/\bAdvertisement\b[\s\S]*$/i, '').trim();
    if (summary.length > 420) summary = `${summary.slice(0, 417).trimEnd()}…`;
    if (summary.length < 25) summary = '';

    items.set(id, {
      id,
      sourceId: VISIT_SOUTHALL.id,
      source: VISIT_SOUTHALL.name,
      sourceClass: VISIT_SOUTHALL.sourceClass,
      sourceHomepage: VISIT_SOUTHALL.homepage,
      mediaType: null,
      title,
      url: url.toString(),
      canonicalUrl: url.toString(),
      summary,
      publishedAt,
      towns: VISIT_SOUTHALL.towns,
      topics: topicGuess(`${title} ${summary}`, VISIT_SOUTHALL.defaultTopics),
      derived: true,
      derivedFrom: 'Dated first-party Visit Southall news listing',
      aiGenerated: false
    });
  }

  return [...items.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

async function fetchRssSource(source) {
  const started = Date.now();
  try {
    const { response, text } = await fetchText(source.url, 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const all = rssItems(source, text);
    return {
      items: all.slice(0, 8),
      archiveItems: all.slice(0, 50),
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: all.length > 0,
        status: all.length ? 'ok' : 'empty',
        error: all.length ? null : 'Feed responded but no dated entries were parsed',
        itemCount: all.length,
        diagnostics: [{ mode: 'rss', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }]
      }
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return {
      items: [], archiveItems: [],
      health: { id: source.id, name: source.name, homepage: source.homepage, ok: false, status: 'error', error: message, itemCount: 0, diagnostics: [{ mode: 'rss', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] }
    };
  }
}

async function fetchVisitSouthall({ deep = false } = {}) {
  const started = Date.now();
  let lastStatus = null;
  let pagesFetched = 0;
  try {
    const all = new Map();
    const urls = deep ? [VISIT_SOUTHALL.currentUrl, VISIT_SOUTHALL.archiveUrl] : [VISIT_SOUTHALL.currentUrl];
    for (const url of urls) {
      try {
        const { response, text } = await fetchText(url);
        lastStatus = response.status;
        if (!response.ok) {
          if (url === VISIT_SOUTHALL.archiveUrl) continue;
          throw new Error(`HTTP ${response.status}`);
        }
        pagesFetched += 1;
        for (const item of extractVisitSouthallItems(text, url)) all.set(item.id, item);
      } catch (error) {
        if (url === VISIT_SOUTHALL.archiveUrl) continue;
        throw error;
      }
    }

    const archiveItems = [...all.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, deep ? 500 : 30);
    return {
      items: archiveItems.slice(0, 8),
      archiveItems,
      health: {
        id: VISIT_SOUTHALL.id,
        name: VISIT_SOUTHALL.name,
        homepage: VISIT_SOUTHALL.homepage,
        ok: archiveItems.length > 0,
        status: archiveItems.length ? 'ok' : 'empty',
        error: archiveItems.length ? null : 'News page responded but no dated story links matched the expected structure',
        itemCount: archiveItems.length,
        diagnostics: [{ mode: deep ? 'visit-southall-news-deep' : 'visit-southall-news-live', outcome: 'http-response', httpStatus: lastStatus, pagesFetched, elapsedMs: Date.now() - started }]
      }
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return {
      items: [], archiveItems: [],
      health: { id: VISIT_SOUTHALL.id, name: VISIT_SOUTHALL.name, homepage: VISIT_SOUTHALL.homepage, ok: false, status: 'error', error: message, itemCount: 0, diagnostics: [{ mode: 'visit-southall-news-live', outcome: 'transport-error', error: message, pagesFetched, elapsedMs: Date.now() - started }] }
    };
  }
}

export async function fetchSouthallExtraSources(options = {}) {
  const [southallSpeaks, vicious, visitSouthall] = await Promise.all([
    fetchRssSource(RSS_SOURCES[0]),
    fetchRssSource(RSS_SOURCES[1]),
    fetchVisitSouthall(options)
  ]);

  const results = [southallSpeaks, vicious, visitSouthall];
  return {
    generatedAt: new Date().toISOString(),
    items: results.flatMap(result => result.items || []),
    archiveItems: results.flatMap(result => result.archiveItems || []),
    health: results.map(result => result.health)
  };
}

export default async () => {
  const data = await fetchSouthallExtraSources();
  return new Response(JSON.stringify({ generatedAt: data.generatedAt, items: data.items, health: data.health }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
