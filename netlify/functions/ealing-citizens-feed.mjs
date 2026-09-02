const SOURCE_URL = 'https://www.citizensuk.org/chapters/west-london/west-london-news/';
const HOME = 'https://www.citizensuk.org/chapters/west-london/';
const localTerms = ['Ealing', 'Southall', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Marston Court', 'Ealing Citizens'];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', ndash: '–', mdash: '—' };
const decode = value => String(value || '')
  .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
  .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => entities[name.toLowerCase()] ?? m);
const strip = value => decode(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const relevant = text => localTerms.some(term => String(text || '').toLowerCase().includes(term.toLowerCase()));

function topicGuess(text) {
  const value = String(text || '').toLowerCase();
  const out = [];
  if (/housing|rent|landlord|temporary accommodation|community land trust|clt/.test(value)) out.push('Housing');
  if (/living wage|jobs|employment|apprentice|work/.test(value)) out.push('Council & democracy');
  if (/election|candidate|assembly|accountability|council/.test(value)) out.push('Council & democracy');
  if (/children|young people|youth|school/.test(value)) out.push('Schools & young people');
  return [...new Set(out.length ? out : ['Community'])].slice(0, 3);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
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
    return { html: await response.text(), status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

function parseListing(html) {
  const results = [];
  const rx = /<a\b[^>]*href=["']([^"']*\/chapters\/west-london\/west-london-news\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = rx.exec(html))) {
    let url;
    try { url = new URL(match[1], SOURCE_URL); } catch { continue; }
    if (url.hostname !== 'www.citizensuk.org') continue;
    url.hash = '';
    const title = strip(match[2]);
    if (title.length < 12 || title.length > 220 || /^(?:read more|learn more)$/i.test(title)) continue;

    // The archive page's surrounding HTML contains neighbouring cards and image
    // attributes, so use it only for a best-effort publication date. Article
    // summaries are fetched from the canonical article page below.
    const before = strip(html.slice(Math.max(0, match.index - 500), match.index));
    const dateMatches = [...before.matchAll(/([0-3]?\d(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})/gi)];
    const dateMatch = dateMatches.at(-1);
    const publishedAt = dateMatch
      ? new Date(`${dateMatch[1].replace(/(st|nd|rd|th)/i, '')} 12:00 GMT`).toISOString()
      : null;

    results.push({ title, url: url.href, publishedAt });
  }
  return [...new Map(results.map(item => [item.url, item])).values()].slice(0, 30);
}

function articleDescription(html, title = '') {
  const metaPatterns = [
    /<meta\b[^>]*(?:name|property)=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']description["'][^>]*>/i,
    /<meta\b[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i
  ];
  for (const rx of metaPatterns) {
    const match = html.match(rx);
    const text = match ? strip(match[1]) : '';
    if (text.length >= 40 && text.toLowerCase() !== title.toLowerCase()) return text.slice(0, 420);
  }

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => strip(match[1]))
    .filter(text => text.length >= 60 && !/cookie|privacy|newsletter|sign up|follow us/i.test(text));
  const paragraph = paragraphs.find(text => !title || !text.toLowerCase().includes(title.toLowerCase()));
  return (paragraph || '').slice(0, 420);
}

function articlePublishedAt(html, fallback) {
  const match = html.match(/<meta\b[^>]*(?:property|name)=["']article:published_time["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || html.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  if (!match) return fallback;
  const timestamp = Date.parse(match[1]);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toISOString();
}

async function enrichCandidate(candidate) {
  try {
    const { html } = await fetchHtml(candidate.url);
    const summary = articleDescription(html, candidate.title);
    const publishedAt = articlePublishedAt(html, candidate.publishedAt);
    const text = `${candidate.title} ${summary}`;
    if (!relevant(text)) return null;
    return {
      id: `ealing-citizens:${candidate.url}`,
      sourceId: 'ealing-citizens',
      source: 'Ealing Citizens / Citizens UK',
      sourceClass: 'Organisation / campaign',
      sourceHomepage: HOME,
      mediaType: null,
      title: candidate.title,
      url: candidate.url,
      canonicalUrl: candidate.url,
      summary,
      publishedAt,
      towns: ['Ealing', ...(text.toLowerCase().includes('southall') ? ['Southall'] : [])],
      boroughWide: true,
      topics: topicGuess(text),
      derived: true,
      derivedFrom: 'Citizens UK West London news archive; canonical article title/date/description used and filtered for explicit Ealing-area relevance'
    };
  } catch {
    // Do not replace a failed article fetch with polluted archive-page prose.
    // A clean title-only item is preferable to fabricated or malformed context.
    if (!relevant(candidate.title)) return null;
    return {
      id: `ealing-citizens:${candidate.url}`,
      sourceId: 'ealing-citizens',
      source: 'Ealing Citizens / Citizens UK',
      sourceClass: 'Organisation / campaign',
      sourceHomepage: HOME,
      mediaType: null,
      title: candidate.title,
      url: candidate.url,
      canonicalUrl: candidate.url,
      summary: '',
      publishedAt: candidate.publishedAt,
      towns: ['Ealing', ...(candidate.title.toLowerCase().includes('southall') ? ['Southall'] : [])],
      boroughWide: true,
      topics: topicGuess(candidate.title),
      derived: true,
      derivedFrom: 'Citizens UK West London news archive; article detail unavailable, title/date retained without invented summary'
    };
  }
}

export async function fetchEalingCitizensFeed() {
  const started = Date.now();
  try {
    const { html, status } = await fetchHtml(SOURCE_URL);
    const candidates = parseListing(html);
    const enriched = await Promise.all(candidates.map(enrichCandidate));
    const items = enriched
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
      .slice(0, 20);
    return {
      generatedAt: new Date().toISOString(),
      items,
      health: [{
        id: 'ealing-citizens',
        name: 'Ealing Citizens / Citizens UK',
        homepage: HOME,
        ok: true,
        status: items.length ? 'ok' : 'empty',
        itemCount: items.length,
        error: items.length ? null : 'Archive fetched but no current entries matched the Ealing-area filter',
        diagnostics: [{ mode: 'canonical-article-enrichment', outcome: 'http-response', httpStatus: status, elapsedMs: Date.now() - started }]
      }]
    };
  } catch (error) {
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      health: [{
        id: 'ealing-citizens',
        name: 'Ealing Citizens / Citizens UK',
        homepage: HOME,
        ok: false,
        status: 'error',
        itemCount: 0,
        error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error)
      }]
    };
  }
}

export default async () => new Response(JSON.stringify(await fetchEalingCitizensFeed()), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, stale-while-revalidate=900',
    'access-control-allow-origin': '*'
  }
});
