import { createHash } from 'node:crypto';

const NEWS_URL = 'https://news.met.police.uk/latest_news';

const localityTerms = [
  'Ealing', 'Southall', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale',
  'Norwood Green', 'Dormers Wells', 'Lady Margaret', 'Northfield', 'Pitshanger',
  'Southfield', 'Walpole', 'Uxbridge Road', 'Ealing Broadway', 'Park Royal'
];

const wards = [
  ['norwood-green', 'Norwood Green'],
  ['southall-broadway', 'Southall Broadway'],
  ['southall-green', 'Southall Green'],
  ['southall-west', 'Southall West']
];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', ndash: '–', mdash: '—' };
const decode = value => String(value || '')
  .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
  .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => entities[name.toLowerCase()] ?? m);
const strip = value => decode(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const relevant = text => localityTerms.some(term => new RegExp(`(^|[^A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`, 'i').test(text));
const topics = text => {
  const value = String(text || '').toLowerCase();
  const out = ['Policing & safety'];
  if (/violence|vawg|domestic abuse|sexual|rape/.test(value)) out.push('Public health');
  if (/road|traffic|vehicle|e-bike|moped/.test(value)) out.push('Transport');
  if (/young|teen|boy|girl|school/.test(value)) out.push('Schools & young people');
  return [...new Set(out)].slice(0, 3);
};

function requestHeaders(browserCompatible = false) {
  return browserCompatible
    ? {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
      }
    : {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      };
}

async function requestHtml(url, browserCompatible = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: requestHeaders(browserCompatible)
    });
    return { response, html: response.ok ? await response.text() : null };
  } finally { clearTimeout(timeout); }
}

async function fetchHtml(url) {
  const diagnostics = [];
  const started = Date.now();
  let result = await requestHtml(url, false);
  diagnostics.push({ mode: 'initial', outcome: 'http-response', httpStatus: result.response.status, elapsedMs: Date.now() - started });

  if ([401, 403, 406, 429].includes(result.response.status)) {
    const retryStarted = Date.now();
    result = await requestHtml(url, true);
    diagnostics.push({ mode: 'browser-compatible', outcome: 'http-response', httpStatus: result.response.status, elapsedMs: Date.now() - retryStarted });
  }

  if (!result.response.ok) {
    const error = new Error(`HTTP ${result.response.status}`);
    error.httpStatus = result.response.status;
    error.diagnostics = diagnostics;
    throw error;
  }

  return { html: result.html, status: result.response.status, diagnostics };
}

function parseNews(html) {
  const items = [];
  const rx = /<a\b[^>]*href=["']([^"']*\/news\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = rx.exec(html))) {
    let url;
    try { url = new URL(match[1], NEWS_URL); } catch { continue; }
    if (url.hostname !== 'news.met.police.uk') continue;
    const title = strip(match[2]);
    if (title.length < 12 || title.length > 220) continue;
    const nearby = strip(html.slice(Math.max(0, match.index - 250), Math.min(html.length, rx.lastIndex + 700)));
    const dateMatch = nearby.match(/([0-3]?\d\s+[A-Za-z]+\s+20\d{2})\s+([0-2]?\d:[0-5]\d)/);
    const publishedAt = dateMatch ? new Date(`${dateMatch[1]} ${dateMatch[2]} GMT`).toISOString() : null;
    const summary = nearby.replace(title, '').replace(dateMatch?.[0] || '', '').trim().slice(0, 420);
    const text = `${title} ${summary}`;
    if (!relevant(text)) continue;
    items.push({
      id: `met-ealing-news:${url.href}`,
      sourceId: 'met-ealing-news',
      source: 'Metropolitan Police — Ealing-relevant news',
      sourceClass: 'Official record',
      sourceHomepage: NEWS_URL,
      mediaType: null,
      title,
      url: url.href,
      canonicalUrl: url.href,
      summary,
      publishedAt,
      towns: localityTerms.filter(term => ['Ealing','Southall','Acton','Greenford','Hanwell','Northolt','Perivale'].includes(term) && text.toLowerCase().includes(term.toLowerCase())),
      boroughWide: /\bEaling\b/i.test(text),
      topics: topics(text),
      derived: true,
      derivedFrom: 'Metropolitan Police newsroom, filtered for explicit Ealing-area relevance'
    });
  }
  return [...new Map(items.map(item => [item.canonicalUrl, item])).values()].sort((a,b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)).slice(0, 20);
}

function prioritySnapshot(html, slug, name, url) {
  const text = strip(html);
  const marker = text.toLowerCase().indexOf('our priorities');
  if (marker < 0) return null;
  let section = text.slice(marker, marker + 2800).trim();
  const stop = section.search(/(?:Crime prevention|Top reported crimes|Crime levels in your area)/i);
  if (stop > 100) section = section.slice(0, stop).trim();
  if (section.length < 80) return null;
  const hash = createHash('sha256').update(section).digest('hex').slice(0, 16);
  const issued = section.match(/Issued\s+([0-3]?\d\s+[A-Za-z]+\s+20\d{2})/i);
  const publishedAt = issued ? new Date(`${issued[1]} 12:00 GMT`).toISOString() : null;
  return {
    id: `met-ealing-priority:${slug}:${hash}`,
    sourceId: `met-ealing-${slug}`,
    source: `Metropolitan Police — ${name} Safer Neighbourhoods`,
    sourceClass: 'Official record',
    sourceHomepage: url,
    mediaType: null,
    title: `${name}: current policing priorities`,
    url,
    canonicalUrl: `${url}#commons-version-${hash}`,
    summary: section.slice(0, 700),
    publishedAt,
    towns: name.startsWith('Southall') || name === 'Norwood Green' ? ['Southall'] : ['Ealing'],
    topics: ['Policing & safety'],
    derived: true,
    derivedFrom: 'Current Metropolitan Police Safer Neighbourhoods priorities page; content-hashed Commons snapshot'
  };
}

function priorityUrl(slug) {
  return `https://www.met.police.uk/area/your-area/met/ealing/${slug}/contact-us/our-priorities`;
}

export async function fetchMetEalingFeed() {
  const started = Date.now();
  const results = await Promise.allSettled([
    fetchHtml(NEWS_URL),
    ...wards.map(([slug]) => fetchHtml(priorityUrl(slug)))
  ]);
  const health = [];
  const items = [];
  if (results[0].status === 'fulfilled') {
    const news = parseNews(results[0].value.html); items.push(...news);
    health.push({ id: 'met-ealing-news', name: 'Metropolitan Police — Ealing-relevant news', homepage: NEWS_URL, ok: true, status: news.length ? 'ok' : 'empty', itemCount: news.length, error: news.length ? null : 'Newsroom fetched but no current items matched the Ealing-area filter', diagnostics: results[0].value.diagnostics });
  } else health.push({ id: 'met-ealing-news', name: 'Metropolitan Police — Ealing-relevant news', homepage: NEWS_URL, ok: false, status: 'error', itemCount: 0, error: String(results[0].reason?.message || results[0].reason), diagnostics: results[0].reason?.diagnostics || [] });

  wards.forEach(([slug, name], index) => {
    const result = results[index + 1];
    const url = priorityUrl(slug);
    if (result.status === 'fulfilled') {
      const item = prioritySnapshot(result.value.html, slug, name, url); if (item) items.push(item);
      health.push({ id: `met-ealing-${slug}`, name: `Metropolitan Police — ${name}`, homepage: url, ok: true, status: item ? 'ok' : 'empty', itemCount: item ? 1 : 0, error: item ? null : 'Page fetched but no priorities section matched', diagnostics: result.value.diagnostics });
    } else {
      const httpStatus = Number(result.reason?.httpStatus || 0);
      const upstreamBlocked = [401,403,406,429].includes(httpStatus);
      health.push({
        id: `met-ealing-${slug}`,
        name: `Metropolitan Police — ${name}`,
        homepage: url,
        ok: false,
        status: upstreamBlocked ? 'blocked' : 'error',
        itemCount: 0,
        error: upstreamBlocked ? `Upstream blocked automated fetch (HTTP ${httpStatus})` : String(result.reason?.message || result.reason),
        diagnostics: result.reason?.diagnostics || []
      });
    }
  });

  return { generatedAt: new Date().toISOString(), items, health, elapsedMs: Date.now() - started };
}

export default async () => new Response(JSON.stringify(await fetchMetEalingFeed()), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, stale-while-revalidate=900', 'access-control-allow-origin': '*' } });
