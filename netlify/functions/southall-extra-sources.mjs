import { XMLParser } from 'fast-xml-parser';

const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];

const SOUTHALL_SPEAKS = {
  id: 'southall-speaks',
  name: 'Southall Speaks',
  url: 'https://atterkalsi.substack.com/feed',
  homepage: 'https://atterkalsi.substack.com/',
  sourceClass: 'Journalism / publishing',
  towns: ['Southall'],
  defaultTopics: ['Community', 'Culture & history']
};

const VICIOUS_EALING = {
  id: 'vicious-ealing-council',
  name: 'Vicious Ealing Council',
  feedUrl: 'https://vicious-ealing-council.co.uk/feed/',
  homepage: 'https://vicious-ealing-council.co.uk/',
  sourceClass: 'Independent civic commentary',
  towns: BOROUGH_TOWNS,
  boroughWide: true,
  defaultTopics: ['Council & democracy']
};

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
      boroughWide: source.boroughWide === true,
      topics: topicGuess(`${title} ${summary}`, source.defaultTopics),
      derived: false,
      aiGenerated: false
    });
  }

  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

function viciousHomepageItems(html = '') {
  const items = new Map();
  const headingRx = /<h[1-3]\b[^>]*>[\s\S]*?<a\b[^>]*href=["'](https?:\/\/vicious-ealing-council\.co\.uk\/[^"'#?]+\/?(?:\?p=\d+)?)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-3]>/gi;
  let match;

  while ((match = headingRx.exec(html))) {
    const title = strip(match[2]);
    if (!title || /^home$/i.test(title)) continue;

    let canonicalUrl;
    try {
      const url = new URL(decodeEntities(match[1]), VICIOUS_EALING.homepage);
      if (!/^(?:www\.)?vicious-ealing-council\.co\.uk$/i.test(url.hostname)) continue;
      url.hash = '';
      canonicalUrl = url.toString();
    } catch {
      continue;
    }

    const nearby = html.slice(headingRx.lastIndex, Math.min(html.length, headingRx.lastIndex + 1500));
    const dateMatch = nearby.match(/Posted\s+on[\s\S]{0,240}?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})/i);
    const publishedAt = dateMatch ? normaliseDate(`${dateMatch[1]} ${dateMatch[2]}, ${dateMatch[3]} 12:00 UTC`) : null;
    if (!publishedAt) continue;

    const paragraphMatch = nearby.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const summaryText = paragraphMatch ? strip(paragraphMatch[1]) : '';
    const summary = summaryText.length > 420 ? `${summaryText.slice(0, 417).trimEnd()}…` : summaryText;

    items.set(canonicalUrl, {
      id: `${VICIOUS_EALING.id}:${canonicalUrl}`,
      sourceId: VICIOUS_EALING.id,
      source: VICIOUS_EALING.name,
      sourceClass: VICIOUS_EALING.sourceClass,
      sourceHomepage: VICIOUS_EALING.homepage,
      mediaType: null,
      title,
      url: canonicalUrl,
      canonicalUrl,
      summary,
      publishedAt,
      towns: VICIOUS_EALING.towns,
      boroughWide: true,
      topics: topicGuess(`${title} ${summary}`, VICIOUS_EALING.defaultTopics),
      derived: true,
      derivedFrom: 'Dated post on the publisher’s public homepage',
      aiGenerated: false
    });
  }

  return [...items.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
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

function extractVisitSouthallItems(html = '') {
  const items = new Map();
  const anchorRx = /<a\b[^>]*href=["']([^"']*NewsDetails\.php\?[^"']*recordID=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorRx.exec(html))) {
    const url = absoluteVisitSouthallUrl(match[1]);
    if (!url) continue;
    const title = strip(match[2]);
    if (!title || title.length < 8 || /^image$/i.test(title)) continue;

    const dateWindow = strip(html.slice(Math.max(0, match.index - 180), Math.min(html.length, anchorRx.lastIndex + 180)));
    const publishedAt = visitSouthallDate(dateWindow);
    if (!publishedAt) continue;

    const id = `${VISIT_SOUTHALL.id}:${url.searchParams.get('recordID')}`;
    const afterAnchor = html.slice(anchorRx.lastIndex);
    const nextBoundaryCandidates = [
      afterAnchor.search(/<hr\b/i),
      afterAnchor.search(/<a\b[^>]*href=["'][^"']*NewsDetails\.php\?[^"']*recordID=\d+/i),
      afterAnchor.search(/\bAdvertisement\b/i)
    ].filter(index => index >= 0);
    const boundary = nextBoundaryCandidates.length ? Math.min(...nextBoundaryCandidates) : Math.min(afterAnchor.length, 900);
    let summary = strip(afterAnchor.slice(0, Math.min(boundary, 900)))
      .replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*\d{1,2}\s+[A-Za-z]+\s+20\d{2}\s*/i, '')
      .replace(/^Image\b\s*/i, '')
      .trim();
    if (/^(?:Recent news|For the archived local news|If you have a local news story)/i.test(summary)) summary = '';
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

async function fetchViciousEaling() {
  const started = Date.now();
  const diagnostics = [];
  let feedError = null;

  try {
    const { response, text } = await fetchText(VICIOUS_EALING.feedUrl, 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5');
    diagnostics.push({ mode: 'rss', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started });
    if (response.ok) {
      const all = rssItems({ ...VICIOUS_EALING, url: VICIOUS_EALING.feedUrl }, text);
      if (all.length) {
        return {
          items: all.slice(0, 8), archiveItems: all.slice(0, 50),
          health: { id: VICIOUS_EALING.id, name: VICIOUS_EALING.name, homepage: VICIOUS_EALING.homepage, ok: true, status: 'ok', error: null, itemCount: all.length, diagnostics }
        };
      }
      feedError = 'Feed responded but no dated entries were parsed';
    } else {
      feedError = `HTTP ${response.status}`;
    }
  } catch (error) {
    feedError = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    diagnostics.push({ mode: 'rss', outcome: 'transport-error', error: feedError, elapsedMs: Date.now() - started });
  }

  try {
    const fallbackStarted = Date.now();
    const { response, text } = await fetchText(VICIOUS_EALING.homepage);
    diagnostics.push({ mode: 'public-page-fallback', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - fallbackStarted });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const all = viciousHomepageItems(text);
    if (!all.length) throw new Error('Homepage responded but no dated posts matched the expected structure');
    return {
      items: all.slice(0, 8), archiveItems: all.slice(0, 50),
      health: { id: VICIOUS_EALING.id, name: VICIOUS_EALING.name, homepage: VICIOUS_EALING.homepage, ok: true, status: 'ok', error: null, itemCount: all.length, diagnostics }
    };
  } catch (error) {
    const fallbackError = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return {
      items: [], archiveItems: [],
      health: {
        id: VICIOUS_EALING.id,
        name: VICIOUS_EALING.name,
        homepage: VICIOUS_EALING.homepage,
        ok: false,
        status: 'error',
        error: `RSS unavailable (${feedError || 'unknown error'}); public-page fallback unavailable (${fallbackError})`,
        itemCount: 0,
        diagnostics
      }
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
        for (const item of extractVisitSouthallItems(text)) all.set(item.id, item);
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
    fetchRssSource(SOUTHALL_SPEAKS),
    fetchViciousEaling(),
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
