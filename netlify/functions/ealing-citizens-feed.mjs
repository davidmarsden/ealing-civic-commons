const SOURCE_URL = 'https://www.citizensuk.org/chapters/west-london/west-london-news/';
const HOME = 'https://www.citizensuk.org/chapters/west-london/';
const localTerms = ['Ealing', 'Southall', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Marston Court', 'Ealing Citizens'];

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', ndash: '–', mdash: '—' };
const decode = value => String(value || '')
  .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
  .replace(/&([a-z][a-z0-9]+);/gi, (m, name) => entities[name.toLowerCase()] ?? m);
const strip = value => decode(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const relevant = text => localTerms.some(term => text.toLowerCase().includes(term.toLowerCase()));

function topicGuess(text) {
  const value = String(text || '').toLowerCase();
  const out = [];
  if (/housing|rent|landlord|temporary accommodation|community land trust|clt/.test(value)) out.push('Housing');
  if (/living wage|jobs|employment|apprentice|work/.test(value)) out.push('Council & democracy');
  if (/election|candidate|assembly|accountability|council/.test(value)) out.push('Council & democracy');
  if (/children|young people|youth|school/.test(value)) out.push('Schools & young people');
  return [...new Set(out.length ? out : ['Community'])].slice(0, 3);
}

function parseItems(html) {
  const results = [];
  const rx = /<a\b[^>]*href=["']([^"']*\/chapters\/west-london\/west-london-news\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = rx.exec(html))) {
    let url;
    try { url = new URL(match[1], SOURCE_URL); } catch { continue; }
    if (url.hostname !== 'www.citizensuk.org') continue;
    const title = strip(match[2]);
    if (title.length < 12 || title.length > 220 || /^read more$/i.test(title)) continue;
    const nearby = strip(html.slice(Math.max(0, match.index - 350), Math.min(html.length, rx.lastIndex + 850)));
    const dateMatch = nearby.match(/([0-3]?\d(?:st|nd|rd|th)?\s+[A-Za-z]+\s+20\d{2})/i);
    const publishedAt = dateMatch ? new Date(`${dateMatch[1].replace(/(st|nd|rd|th)/i, '')} 12:00 GMT`).toISOString() : null;
    const summary = nearby.replace(title, '').replace(dateMatch?.[0] || '', '').trim().slice(0, 420);
    const text = `${title} ${summary}`;
    if (!relevant(text)) continue;
    results.push({
      id: `ealing-citizens:${url.href}`,
      sourceId: 'ealing-citizens',
      source: 'Ealing Citizens / Citizens UK',
      sourceClass: 'Organisation / campaign',
      sourceHomepage: HOME,
      mediaType: null,
      title,
      url: url.href,
      canonicalUrl: url.href,
      summary,
      publishedAt,
      towns: ['Ealing', ...(text.toLowerCase().includes('southall') ? ['Southall'] : [])],
      boroughWide: true,
      topics: topicGuess(text),
      derived: true,
      derivedFrom: 'Citizens UK West London news archive, filtered for explicit Ealing-area relevance'
    });
  }
  return [...new Map(results.map(item => [item.canonicalUrl, item])).values()].sort((a,b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0)).slice(0, 20);
}

export async function fetchEalingCitizensFeed() {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response;
    try {
      response = await fetch(SOURCE_URL, { redirect: 'follow', signal: controller.signal, headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en-GB,en;q=0.9', 'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)' } });
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = parseItems(await response.text());
    return { generatedAt: new Date().toISOString(), items, health: [{ id: 'ealing-citizens', name: 'Ealing Citizens / Citizens UK', homepage: HOME, ok: true, status: items.length ? 'ok' : 'empty', itemCount: items.length, error: items.length ? null : 'Archive fetched but no current entries matched the Ealing-area filter', diagnostics: [{ mode: 'structured-page-watch', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }] }] };
  } catch (error) {
    return { generatedAt: new Date().toISOString(), items: [], health: [{ id: 'ealing-citizens', name: 'Ealing Citizens / Citizens UK', homepage: HOME, ok: false, status: 'error', itemCount: 0, error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error) }] };
  }
}

export default async () => new Response(JSON.stringify(await fetchEalingCitizensFeed()), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, stale-while-revalidate=900', 'access-control-allow-origin': '*' } });
