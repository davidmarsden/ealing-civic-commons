import { readSnapshot, readSourceState, store } from '../lib/feed-snapshot.mjs';
import { PUBLIC_FEEDS, YOUTUBE_HANDLES } from '../lib/source-feeds.mjs';
import { cachedChannelId, channelFeedUrl } from '../lib/youtube-channels.mjs';

// FollowSpec (socialspec.org): the sources the Commons follows, as an OPML 2.0
// subscription list at /.well-known/following.opml. Built from the live source
// register (the feed snapshot's health entries), so retired sources drop out and
// new ones appear without editing a second list. Sources with a public feed are
// rss outlines; watched pages without one are link outlines to their homepage.
// A missing snapshot is an error, never an empty list.
//
// When a whole fetcher fails, its sources are reported under one synthetic entry
// (fetcherFailed). They are not retired, so the list fills that group from the
// identities kept in the source state when they last succeeded.
const SITE = 'https://ealing.civiccommons.co.uk/';
const HEADERS = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=900'
};

const escapeXml = value => String(value ?? '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const attrs = values => Object.entries(values).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}="${escapeXml(v)}"`).join(' ');

export function followedSources(health, sourceState = {}) {
  const entries = Array.isArray(health) ? health : [];
  const failedGroups = new Set(entries.filter(entry => entry?.fetcherFailed && entry.group).map(entry => entry.group));
  const remembered = Object.entries(sourceState?.sources || {})
    .filter(([, value]) => value?.meta?.name && failedGroups.has(value.meta.group))
    .map(([id, value]) => ({ id, ...value.meta }));
  return [...entries.filter(entry => !entry?.fetcherFailed), ...remembered];
}

export function buildFollowingOpml(health, { generatedAt = new Date().toISOString(), feeds = PUBLIC_FEEDS, sourceState = {} } = {}) {
  const seen = new Set();
  const sources = followedSources(health, sourceState)
    .filter(entry => entry?.id && entry?.name && !seen.has(entry.id) && seen.add(entry.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const withFeed = sources.filter(entry => feeds[entry.id]);
  const pages = sources.filter(entry => !feeds[entry.id] && entry.homepage);
  const date = new Date(generatedAt).toUTCString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    '    <title>Ealing Civic Commons: sources we follow</title>',
    `    <dateModified>${escapeXml(date)}</dateModified>`,
    '    <ownerName>Ealing Civic Commons</ownerName>',
    `    <ownerId>${SITE}</ownerId>`,
    '    <docs>https://opml.org/spec2.opml</docs>',
    '  </head>',
    '  <body>',
    `    <outline ${attrs({ text: 'Feeds', title: 'Feeds' })}>`,
    ...withFeed.map(entry => `      <outline ${attrs({ type: 'rss', text: entry.name, title: entry.name, xmlUrl: feeds[entry.id], htmlUrl: entry.homepage, category: entry.sourceClass })}/>`),
    '    </outline>',
    `    <outline ${attrs({ text: 'Pages watched (no public feed)', title: 'Pages watched (no public feed)' })}>`,
    ...pages.map(entry => `      <outline ${attrs({ type: 'link', text: entry.name, url: entry.homepage, category: entry.sourceClass })}/>`),
    '    </outline>',
    '  </body>',
    '</opml>',
    ''
  ].join('\n');
}

// Feed URLs for this response: the fixed map plus @handle channels whose IDs the
// ingest has cached.
export async function feedsWithChannels(cache, feeds = PUBLIC_FEEDS, handles = YOUTUBE_HANDLES) {
  const resolved = await Promise.all(Object.entries(handles).map(async ([id, handle]) => [id, await cachedChannelId(handle, cache)]));
  return { ...feeds, ...Object.fromEntries(resolved.filter(([, channelId]) => channelId).map(([id, channelId]) => [id, channelFeedUrl(channelId)])) };
}

export default async () => {
  const blobs = store();
  const snapshot = await readSnapshot(blobs).catch(() => null);
  if (!snapshot?.feed?.health?.length) {
    return new Response('The source register is temporarily unavailable.\n', { status: 503, headers: { ...HEADERS, 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8', 'retry-after': '300' } });
  }
  const [feeds, sourceState] = await Promise.all([feedsWithChannels(blobs), readSourceState(blobs).catch(() => ({}))]);
  return new Response(buildFollowingOpml(snapshot.feed.health, { generatedAt: snapshot.feed.generatedAt, feeds, sourceState }), {
    headers: { ...HEADERS, 'content-type': 'text/x-opml; charset=utf-8' }
  });
};

export const config = { path: '/.well-known/following.opml' };
