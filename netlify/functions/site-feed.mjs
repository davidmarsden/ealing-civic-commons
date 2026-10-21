import { readSnapshot, store } from '../lib/feed-snapshot.mjs';
import { sourceEntry, xml } from '../lib/rss-items.mjs';

// The Commons' own feed at /feed.xml (the SocialSpec entry point): the latest
// civic timeline as RSS 2.0, served from the ingest's snapshot. Each item links
// to its Commons page and names the original publisher, which stays canonical.
// A missing snapshot is an error, never an empty feed.
const SITE = 'https://ealing.civiccommons.co.uk';
const MAX_ITEMS = 50;
const CORS = { 'access-control-allow-origin': '*' };

// A date more than a day after the feed was built is a publisher's mistake (the
// Met issued a ward priority "20 November 2026" in October 2026); in a feed it
// would pin the item to the top of readers for weeks. Such items stay, undated.
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export function buildSiteFeed(feed, { siteOrigin = SITE, limit = MAX_ITEMS } = {}) {
  const generated = Date.parse(feed?.generatedAt || '') || Date.now();
  const time = item => { const t = Date.parse(item.publishedAt || ''); return Number.isFinite(t) && t <= generated + FUTURE_TOLERANCE_MS ? t : null; };
  const items = (Array.isArray(feed?.items) ? feed.items : [])
    .filter(item => item?.id && item?.title)
    .map(item => (time(item) == null && item.publishedAt ? { ...item, publishedAt: null } : item))
    .sort((a, b) => (time(b) ?? 0) - (time(a) ?? 0))
    .slice(0, limit);
  const built = new Date(generated).toUTCString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>Ealing Civic Commons</title>',
    `    <link>${xml(`${siteOrigin}/`)}</link>`,
    '    <description>Local reporting, community voices and official democratic records across the London Borough of Ealing, in one chronological timeline. Original publishers remain canonical.</description>',
    '    <language>en-gb</language>',
    `    <lastBuildDate>${xml(built)}</lastBuildDate>`,
    '    <ttl>15</ttl>',
    `    <atom:link href="${xml(`${siteOrigin}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    ...items.map(item => sourceEntry(item, siteOrigin).xml),
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}

export default async () => {
  const snapshot = await readSnapshot(store()).catch(() => null);
  if (!snapshot?.feed?.items?.length) {
    return new Response('The Civic Commons feed is temporarily unavailable.\n', { status: 503, headers: { ...CORS, 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8', 'retry-after': '300' } });
  }
  return new Response(buildSiteFeed(snapshot.feed), {
    headers: { ...CORS, 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' }
  });
};

export const config = { path: '/feed.xml' };
