import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => typeof value === 'object' && value !== null ? value['#text'] ?? '' : value ?? '';

const sources = [
  {
    id: 'sgss-southall-youtube-civic',
    name: 'Sri Guru Singh Sabha Southall — civic/community video',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCX6GRph5cHvjuwGK85cxMyA',
    homepage: 'https://www.youtube.com/@SgssSouthall_live',
    sourceClass: 'Community / faith',
    towns: ['Southall'],
    include: /lecture|community|interfaith|history|heritage|education|youth|health|campaign|discussion|seminar|conference|public|diaspora|environment|charity|civic/i,
    exclude: /(?:morning|evening) livestream|daily divaan|nitnem|hukamnama|kirtan livestream/i,
    topics: ['Community']
  },
  {
    id: 'met-youtube-ealing',
    name: 'Metropolitan Police — Ealing-relevant video',
    feed: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCFVNcTitsrWH4ko_HdE9Hzw',
    homepage: 'https://www.youtube.com/@MetropolitanPoliceUK',
    sourceClass: 'Official record',
    towns: ['Ealing', 'Southall'],
    include: /Ealing|Southall|Acton|Greenford|Hanwell|Northolt|Perivale|Norwood Green|Dormers Wells|Lady Margaret|Park Royal|Ealing Broadway|Southall Broadway|Southall Green|Southall West/i,
    exclude: null,
    topics: ['Policing & safety']
  }
];

function strip(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchXml(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch(source.feed, { signal: controller.signal, headers: { accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.5', 'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally { clearTimeout(timeout); }
}

function parseSource(source, xml) {
  const data = parser.parse(xml);
  return arr(data?.feed?.entry).map(entry => {
    const title = strip(text(entry.title));
    const description = strip(text(entry?.['media:group']?.['media:description']) || text(entry?.content));
    const haystack = `${title} ${description}`;
    if (!source.include.test(haystack) || (source.exclude && source.exclude.test(haystack))) return null;
    const videoId = text(entry?.['yt:videoId']);
    const link = arr(entry.link).find(item => item?.['@_rel'] === 'alternate')?.['@_href'] || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
    if (!link) return null;
    return {
      id: `${source.id}:${videoId || link}`,
      sourceId: source.id,
      source: source.name,
      sourceClass: source.sourceClass,
      sourceHomepage: source.homepage,
      mediaType: 'video',
      title,
      url: link,
      canonicalUrl: link,
      summary: description.slice(0, 700),
      publishedAt: text(entry.published) || text(entry.updated) || null,
      towns: source.towns,
      topics: source.topics,
      derived: true,
      derivedFrom: 'Official YouTube Atom feed filtered for explicit local/civic relevance'
    };
  }).filter(Boolean).slice(0, 20);
}

export async function fetchFilteredVideoFeed() {
  const results = await Promise.allSettled(sources.map(async source => ({ source, items: parseSource(source, await fetchXml(source)) })));
  const items = [];
  const health = [];
  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === 'fulfilled') {
      items.push(...result.value.items);
      health.push({ id: source.id, name: source.name, homepage: source.homepage, ok: true, status: result.value.items.length ? 'ok' : 'empty', itemCount: result.value.items.length, error: result.value.items.length ? null : 'Feed fetched but no current videos matched the civic/local filter' });
    } else health.push({ id: source.id, name: source.name, homepage: source.homepage, ok: false, status: 'error', itemCount: 0, error: String(result.reason?.message || result.reason) });
  });
  return { generatedAt: new Date().toISOString(), items, health };
}

export default async () => new Response(JSON.stringify(await fetchFilteredVideoFeed()), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, stale-while-revalidate=900', 'access-control-allow-origin': '*' } });
