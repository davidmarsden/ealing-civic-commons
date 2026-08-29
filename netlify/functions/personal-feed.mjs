import feedHandler from './feed.mjs';
import { getArchivedItem } from '../lib/civic-items.mjs';

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
  const overflow = new Set();

  for (const [key, value] of url.searchParams.entries()) {
    if (!allowedParams.has(key)) continue;
    const target = String(value ?? '').trim();
    if (!validTarget(key, target)) continue;
    const type = mapping[key];
    if (targets[type].includes(target)) continue;
    if (targets[type].length >= MAX_TARGETS_PER_TYPE) {
      overflow.add(key);
      continue;
    }
    targets[type].push(target);
  }

  return { targets, overflow: [...overflow] };
}

function targetCount(targets) {
  return Object.values(targets).reduce((total, values) => total + values.length, 0);
}

function matches(item, targets) {
  if (targets.items.includes(stableItemKey(item.id))) return true;
  if (targets.sources.includes(item.sourceId)) return true;
  if (item.boroughWide === true && targets.towns.length) return true;
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

function sourceEntry(item, siteOrigin) {
  const key = stableItemKey(item.id);
  const commonsUrl = `${siteOrigin}/items/${encodeURIComponent(key)}`;
  const originalUrl = item.url || item.sourceHomepage || siteOrigin;
  const sourceUrl = item.sourceHomepage || originalUrl;
  const description = [item.summary || '', `Source: ${item.source}`, `Original: ${originalUrl}`].filter(Boolean).join('\n\n');
  return {
    sortDate: item.publishedAt || null,
    xml: `    <item>\n      <title>${xml(item.title)}</title>\n      <link>${xml(commonsUrl)}</link>\n      <guid isPermaLink="false">${xml(`civic-item:${key}`)}</guid>${item.publishedAt ? `\n      <pubDate>${xml(new Date(item.publishedAt).toUTCString())}</pubDate>` : ''}\n      <description>${xml(description)}</description>\n      <source url="${xml(sourceUrl)}">${xml(item.source)}</source>\n    </item>`
  };
}

function contributionEntry(contribution, siteOrigin, titleByThread) {
  const key = String(contribution.threadId || '').replace(/^civic-item:/, '');
  const commonsUrl = `${siteOrigin}/items/${encodeURIComponent(key)}#contribution-${encodeURIComponent(contribution.id)}`;
  const itemTitle = titleByThread.get(contribution.threadId);
  const title = itemTitle ? `${contribution.type}: ${itemTitle}` : `${contribution.type}: Civic Commons update`;
  const description = [
    contribution.body,
    contribution.relatedUrl ? `Related source: ${contribution.relatedUrl}` : '',
    contribution.provenance || 'Published by Civic Commons after moderation.'
  ].filter(Boolean).join('\n\n');
  return {
    sortDate: contribution.publishedAt || contribution.submittedAt || null,
    xml: `    <item>\n      <title>${xml(title)}</title>\n      <link>${xml(commonsUrl)}</link>\n      <guid isPermaLink="false">${xml(`civic-contribution:${contribution.id}`)}</guid>${contribution.publishedAt ? `\n      <pubDate>${xml(new Date(contribution.publishedAt).toUTCString())}</pubDate>` : ''}\n      <description>${xml(description)}</description>\n      <category>${xml(contribution.type)}</category>\n    </item>`
  };
}

async function loadPublishedContributions(requestUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(new URL('/data/contributions.json', requestUrl), {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.contributions)
      ? data.contributions.filter(entry => entry && entry.status === 'published' && entry.id && entry.threadId && entry.body)
      : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function loadArchivedFollowedItems(keys, liveItems) {
  if (!keys.length) return [];
  const liveKeys = new Set((liveItems || []).map(item => stableItemKey(item.id)));
  const missing = keys.filter(key => !liveKeys.has(key));
  const settled = await Promise.allSettled(missing.map(key => getArchivedItem(key)));
  return settled
    .filter(result => result.status === 'fulfilled' && result.value?.item)
    .map(result => result.value.item);
}

export default async request => {
  const requestUrl = new URL(request.url);
  const { targets, overflow } = readTargets(requestUrl);

  if (overflow.length) {
    return new Response(`Personal Civic Commons RSS supports at most ${MAX_TARGETS_PER_TYPE} unique follows per type. Too many: ${overflow.join(', ')}.`, {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  if (!targetCount(targets)) {
    return new Response('Personal Civic Commons RSS requires at least one valid item, source, town or topic follow.', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  let upstream;
  const contributionsPromise = loadPublishedContributions(request.url);
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
  const liveItems = data.items || [];
  const archivedFollowedItems = await loadArchivedFollowedItems(targets.items, liveItems);
  const combinedItems = [...liveItems, ...archivedFollowedItems];
  const matchedItems = combinedItems.filter(item => matches(item, targets));
  const siteOrigin = requestUrl.origin;
  const feedUrl = canonicalFeedUrl(request.url, targets);
  const titleByThread = new Map(combinedItems.map(item => [`civic-item:${stableItemKey(item.id)}`, item.title]));
  const followedThreads = new Set(targets.items.map(key => `civic-item:${key}`));
  matchedItems.forEach(item => followedThreads.add(`civic-item:${stableItemKey(item.id)}`));

  const contributions = await contributionsPromise;
  const matchedContributions = contributions.filter(entry => followedThreads.has(entry.threadId));
  const entries = [
    ...matchedItems.map(item => sourceEntry(item, siteOrigin)),
    ...matchedContributions.map(entry => contributionEntry(entry, siteOrigin, titleByThread))
  ].sort((a, b) => {
    const ad = a.sortDate ? Date.parse(a.sortDate) : 0;
    const bd = b.sortDate ? Date.parse(b.sortDate) : 0;
    return bd - ad;
  });

  const generated = data.generatedAt ? new Date(data.generatedAt).toUTCString() : new Date().toUTCString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>My Civic Commons follows</title>\n    <link>${xml(`${siteOrigin}/#following`)}</link>\n    <description>Chronological civic information and approved Commons updates matching this feed&apos;s followed stories, sources, places and topics. Original publishers remain canonical.</description>\n    <language>en-gb</language>\n    <lastBuildDate>${xml(generated)}</lastBuildDate>\n    <atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml" />\n${entries.map(entry => entry.xml).join('\n')}\n  </channel>\n</rss>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
