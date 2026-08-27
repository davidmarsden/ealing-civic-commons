import feedHandler from './feed.mjs';

const MAX_TARGETS_PER_TYPE = 50;
const MAX_TARGET_LENGTH = 512;
const allowedParams = new Set(['item', 'source', 'town', 'topic']);

function xml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stableItemKey(id) {
  return Buffer.from(String(id ?? ''), 'utf8').toString('base64url');
}

function validTarget(param, value) {
  if (!value || value.length > MAX_TARGET_LENGTH) return false;
  if (param === 'item') return /^[A-Za-z0-9_-]+$/.test(value);
  return !/[\u0000-\u001F\u007F]/.test(value);
}

function readTargets(url) {
  const targets = { items: [], sources: [], towns: [], topics: [] };
  const mapping = { item: 'items', source: 'sources', town: 'towns', topic: 'topics' };

  for (const [key, value] of url.searchParams.entries()) {
    if (!allowedParams.has(key)) continue;
    const target = String(value ?? '').trim();
    if (!validTarget(key, target)) continue;
    const type = mapping[key];
    if (!targets[type].includes(target) && targets[type].length < MAX_TARGETS_PER_TYPE) {
      targets[type].push(target);
    }
  }

  return targets;
}

function targetCount(targets) {
  return Object.values(targets).reduce((total, values) => total + values.length, 0);
}

function matches(item, targets) {
  if (targets.items.includes(stableItemKey(item.id))) return true;
  if (targets.sources.includes(item.sourceId)) return true;
  if ((item.towns || []).some(town => targets.towns.includes(town))) return true;
  if ((item.topics || []).some(topic => targets.topics.includes(topic))) return true;
  return false;
}

function canonicalFeedUrl(requestUrl, targets) {
  const url = new URL(requestUrl);
  url.search = '';
  const ordered = [
    ['item', targets.items],
    ['source', targets.sources],
    ['town', targets.towns],
    ['topic', targets.topics]
  ];
  ordered.forEach(([name, values]) => values.forEach(value => url.searchParams.append(name, value)));
  return url.href;
}

function itemXml(item, siteOrigin) {
  const key = stableItemKey(item.id);
  const commonsUrl = `${siteOrigin}/items/${encodeURIComponent(key)}`;
  const originalUrl = item.url || item.sourceHomepage || siteOrigin;
  const sourceUrl = item.sourceHomepage || originalUrl;
  const description = [
    item.summary || '',
    `Source: ${item.source}`,
    `Original: ${originalUrl}`
  ].filter(Boolean).join('\n\n');
  const published = item.publishedAt ? new Date(item.publishedAt).toUTCString() : null;

  return `    <item>\n      <title>${xml(item.title)}</title>\n      <link>${xml(commonsUrl)}</link>\n      <guid isPermaLink="false">${xml(`civic-item:${key}`)}</guid>${published ? `\n      <pubDate>${xml(published)}</pubDate>` : ''}\n      <description>${xml(description)}</description>\n      <source url="${xml(sourceUrl)}">${xml(item.source)}</source>\n    </item>`;
}

export default async request => {
  const requestUrl = new URL(request.url);
  const targets = readTargets(requestUrl);

  if (!targetCount(targets)) {
    return new Response('Personal Civic Commons RSS requires at least one valid item, source, town or topic follow.', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  let upstream;
  try {
    upstream = await feedHandler();
  } catch (error) {
    console.error('Personal RSS upstream feed failed', error);
    return new Response('Civic Commons feed is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  if (!upstream.ok) {
    return new Response('Civic Commons feed is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  const data = await upstream.json();
  const items = (data.items || []).filter(item => matches(item, targets));
  const siteOrigin = requestUrl.origin;
  const feedUrl = canonicalFeedUrl(request.url, targets);
  const generated = data.generatedAt ? new Date(data.generatedAt).toUTCString() : new Date().toUTCString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>My Civic Commons follows</title>\n    <link>${xml(`${siteOrigin}/#following`)}</link>\n    <description>Chronological civic information matching this feed&apos;s followed stories, sources, places and topics. Original publishers remain canonical.</description>\n    <language>en-gb</language>\n    <lastBuildDate>${xml(generated)}</lastBuildDate>\n    <atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml" />\n${items.map(item => itemXml(item, siteOrigin)).join('\n')}\n  </channel>\n</rss>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
