import { serveCombinedFeed } from './combined-feed.mjs';
import { withPlausibleDate } from '../lib/item-dates.mjs';
import { sourceEntry, xml } from '../lib/rss-items.mjs';

// The Commons' own feed at /feed.xml (the SocialSpec entry point): the latest
// civic timeline as RSS 2.0. It reads the timeline the way the homepage does: the
// ingest's snapshot while fresh, a live build when it is missing or stale, so a
// stalled ingest never leaves subscribers on old items. Each item links to its
// Commons page and names the original publisher, which stays canonical. If no
// timeline can be had, the answer is an error, never an empty feed.
const SITE = 'https://ealing.civiccommons.co.uk';
const MAX_ITEMS = 50;
const CORS = { 'access-control-allow-origin': '*' };

export function buildSiteFeed(feed, { siteOrigin = SITE, limit = MAX_ITEMS } = {}) {
  const generated = Date.parse(feed?.generatedAt || '') || Date.now();
  const time = item => { const t = Date.parse(item.publishedAt || ''); return Number.isFinite(t) ? t : 0; };
  // Impossible future dates are already cleared when the timeline is built; this
  // also covers a snapshot written before that rule existed.
  const items = (Array.isArray(feed?.items) ? feed.items : [])
    .filter(item => item?.id && item?.title)
    .map(item => withPlausibleDate(item, generated))
    .sort((a, b) => time(b) - time(a))
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

export async function serveSiteFeed(request, { serve = serveCombinedFeed } = {}) {
  const unavailable = () => new Response('The Civic Commons feed is temporarily unavailable.\n', { status: 503, headers: { ...CORS, 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8', 'retry-after': '300' } });
  let feed;
  try {
    const response = await serve(request);
    if (!response?.ok) return unavailable();
    feed = await response.json();
  } catch (error) {
    console.error('Site feed: timeline unavailable', error);
    return unavailable();
  }
  if (!feed?.items?.length) return unavailable();
  return new Response(buildSiteFeed(feed), {
    headers: { ...CORS, 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' }
  });
}

export default request => serveSiteFeed(request);

export const config = { path: '/feed.xml' };
