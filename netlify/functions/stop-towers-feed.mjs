const SOURCE = {
  id: 'stop-the-towers-news',
  name: 'Stop The Towers — Campaign News',
  homepage: 'https://stopthetowers.info/',
  url: 'https://stopthetowers.info/blog',
  sourceClass: 'Organisation / campaign'
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—');
}

function strip(value = '') {
  return decodeEntities(String(value).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseDate(value = '') {
  const match = String(value).match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),\s*(20\d{2})\b/i);
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]} ${match[2]}, ${match[3]}`);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function absoluteArticleUrl(href) {
  try {
    const url = new URL(decodeEntities(href), SOURCE.url);
    if (!/^https?:$/.test(url.protocol) || !/^(?:www\.)?stopthetowers\.info$/i.test(url.hostname)) return null;
    if (!/^\/[a-z0-9][a-z0-9-]+\/?$/i.test(url.pathname)) return null;
    url.hash = '';
    url.search = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href;
  } catch {
    return null;
  }
}

function topics(text = '') {
  const value = String(text).toLowerCase();
  const out = ['Planning & development'];
  if (/council|inquiry|planning committee|appeal|inspector/.test(value)) out.push('Council & democracy');
  if (/park|green|metropolitan open land|mol/.test(value)) out.push('Environment');
  if (/housing|flats|homes/.test(value)) out.push('Housing');
  return [...new Set(out)].slice(0, 3);
}

function extractItems(html = '') {
  const items = [];
  const articleRx = /<h2\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2\b|<section\b|<footer\b|$)/gi;
  let match;
  while ((match = articleRx.exec(html))) {
    const url = absoluteArticleUrl(match[1]);
    const title = strip(match[2]);
    const publishedAt = parseDate(strip(match[3]).slice(0, 220));
    if (!url || !title || !publishedAt) continue;

    const summaryMatch = match[3].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const summary = summaryMatch ? strip(summaryMatch[1]) : '';
    items.push({
      id: `${SOURCE.id}:${url}`,
      sourceId: SOURCE.id,
      source: SOURCE.name,
      sourceClass: SOURCE.sourceClass,
      sourceHomepage: SOURCE.homepage,
      mediaType: null,
      title,
      url,
      canonicalUrl: url,
      summary: summary.length > 420 ? `${summary.slice(0, 417).trimEnd()}…` : summary,
      publishedAt,
      towns: ['Ealing'],
      topics: topics(`${title} ${summary}`),
      derived: true,
      derivedFrom: 'Structured first-party campaign news page'
    });
  }
  return [...new Map(items.map(item => [item.canonicalUrl, item])).values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

async function fetchHtml() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(SOURCE.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    return { response, html: response.ok ? await response.text() : '' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStopTowersFeed({ deep = false } = {}) {
  const started = Date.now();
  try {
    const { response, html } = await fetchHtml();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const all = extractItems(html);
    const archiveItems = all.slice(0, deep ? 150 : 12);
    const items = archiveItems.slice(0, 6);
    return {
      generatedAt: new Date().toISOString(),
      items,
      archiveItems,
      health: [{
        ...SOURCE,
        ok: all.length > 0,
        status: all.length ? 'ok' : 'empty',
        error: all.length ? null : 'Campaign page responded but no dated news entries matched the expected structure',
        itemCount: all.length,
        diagnostics: [{ mode: deep ? 'campaign-news-deep' : 'campaign-news-live', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }]
      }]
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      archiveItems: [],
      health: [{ ...SOURCE, ok: false, status: 'error', error: message, itemCount: 0, diagnostics: [{ mode: 'campaign-news-live', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] }]
    };
  }
}

export default async () => {
  const data = await fetchStopTowersFeed();
  return new Response(JSON.stringify({ generatedAt: data.generatedAt, items: data.items, health: data.health }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
