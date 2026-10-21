#!/usr/bin/env node
// SocialSpec files: the FollowSpec OPML builder, the feed map's coverage of the
// adapters, and the static AboutSpec / ContactSpec files with their CORS headers.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { PUBLIC_FEEDS, YOUTUBE_HANDLES } from '../netlify/lib/source-feeds.mjs';
import { buildFollowingOpml, feedsWithChannels, followedSources } from '../netlify/functions/socialspec-following.mjs';
import { applySourceStates } from '../netlify/lib/feed-snapshot.mjs';
import { buildSiteFeed, serveSiteFeed } from '../netlify/functions/site-feed.mjs';
import { serveCombinedFeed } from '../netlify/functions/combined-feed.mjs';

// OPML: feeds become rss outlines, other sources link outlines; names escaped;
// duplicates dropped; valid XML.
const health = [
  { id: 'southall-stories', name: 'Southall Stories', homepage: 'https://southallstories.uk/' },
  { id: 'stop-the-towers-news', name: 'Stop The Towers — "Campaign" News & Updates', homepage: 'https://stopthetowers.info/' },
  { id: 'southall-stories', name: 'Southall Stories', homepage: 'https://southallstories.uk/' },
  { id: 'no-home', name: 'Aggregate without homepage' }
];
const xml = buildFollowingOpml(health, { generatedAt: '2026-10-20T12:00:00Z' });
const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(xml);
assert.equal(parsed.opml.version, '2.0');
const [feeds, pages] = parsed.opml.body.outline;
const asList = value => [value.outline].flat().filter(Boolean);
assert.deepEqual(asList(feeds).map(o => [o.type, o.xmlUrl, o.htmlUrl]), [['rss', PUBLIC_FEEDS['southall-stories'], 'https://southallstories.uk/']]);
assert.deepEqual(asList(pages).map(o => [o.type, o.text, o.url]), [['link', 'Stop The Towers — "Campaign" News & Updates', 'https://stopthetowers.info/']]);
assert.match(xml, /&quot;Campaign&quot; News &amp; Updates/);
assert.match(xml, /<dateModified>Tue, 20 Oct 2026 12:00:00 GMT<\/dateModified>/);

// A failed fetcher group keeps its sources in the list (from the state kept when
// they last succeeded); a source that is simply absent is retired and drops out.
{
  const run1 = applySourceStates({ items: [], health: [
    { id: 'positive-greenford', name: 'Positive Greenford', homepage: 'https://positivegreenford.com/', ok: true, itemCount: 1, group: 'boroughTown' },
    { id: 'retired-source', name: 'Retired source', homepage: 'https://retired.example/', ok: true, itemCount: 1, group: 'local' }
  ] }, undefined, '2026-10-20T10:00:00Z').state;
  assert.deepEqual(run1.sources['positive-greenford'].meta, { name: 'Positive Greenford', homepage: 'https://positivegreenford.com/', sourceClass: null, group: 'boroughTown' });
  const health2 = [{ id: 'borough-town-sources', name: 'Additional borough town sources', ok: false, status: 'error', error: 'boom', itemCount: 0, group: 'boroughTown', fetcherFailed: true }];
  const run2 = applySourceStates({ items: [], health: health2 }, run1, '2026-10-20T10:15:00Z');
  assert.ok(run2.state.sources['positive-greenford'].meta, 'identity kept while the group fails');
  const listed = followedSources(run2.feed.health, run2.state).map(entry => entry.id);
  assert.deepEqual(listed, ['positive-greenford'], 'failed group filled from state; synthetic entry and retired source left out');
  assert.match(buildFollowingOpml(run2.feed.health, { sourceState: run2.state }), /xmlUrl="https:\/\/positivegreenford\.com\/feed\/"/);
}

// @handle channels use the ingest's cached channel ID, or stay links if none.
{
  const cache = { get: async key => key === 'youtube/handle/eci-southall' ? { channelId: 'UCabcdefghijklmnopqrstuv', resolvedAt: new Date().toISOString() } : null };
  const feeds = await feedsWithChannels(cache);
  assert.equal(feeds['eci-southall-youtube'], 'https://www.youtube.com/feeds/videos.xml?channel_id=UCabcdefghijklmnopqrstuv');
  assert.equal(feeds['eci-ealing-youtube'], undefined);
  assert.equal(feeds['southall-stories'], PUBLIC_FEEDS['southall-stories']);
}

// The map holds publishers' own feeds: no relays, bridges or our own hosts.
for (const [id, url] of Object.entries(PUBLIC_FEEDS)) {
  assert.match(url, /^https:\/\//, id);
  assert.doesNotMatch(url, /civiccommons\.co\.uk|_relay|rss2json/, `${id} must be the publisher's feed`);
}

// Every feed URL written in an adapter is in the map, so a new RSS source cannot
// be left out of the list. (Relays/bridges and the council-topics enrichment
// feeds, which are not sources, and URLs templated at runtime are exempt.)
const EXEMPT = [/civiccommons\.co\.uk/, /rss2json/, /ealing\.gov\.uk\/rss\/\d+\/news/, /\$\{/];
const mapped = new Set(Object.values(PUBLIC_FEEDS));
const handles = new Set(Object.values(YOUTUBE_HANDLES));
for (const file of (await readdir('netlify/functions')).filter(name => name.endsWith('.mjs'))) {
  const source = await readFile(`netlify/functions/${file}`, 'utf8');
  for (const [, url] of source.matchAll(/['"`](https?:\/\/[^'"`\s]*(?:\/feed\/?|\/feed\.xml|\/rss[^'"`\s]*|\.xml\?[^'"`\s]*|mgRss\.aspx[^'"`\s]*))['"`]/g)) {
    if (EXEMPT.some(pattern => pattern.test(url))) continue;
    // ?user=<handle> for an @handle channel is resolved via its cached channel ID.
    if (handles.has(new URL(url).searchParams.get('user'))) continue;
    assert.ok(mapped.has(url), `${file}: feed ${url} is not in netlify/lib/source-feeds.mjs`);
  }
}

// Site feed (/feed.xml): newest items first, capped, escaped, valid RSS 2.0 with
// a self link; each item links to its Commons page and names the publisher.
{
  const items = Array.from({ length: 60 }, (_, i) => ({ id: `src:${i}`, title: `Item ${i} & "more"`, source: 'Southall Stories', sourceHomepage: 'https://southallstories.uk/', url: `https://southallstories.uk/${i}`, publishedAt: new Date(Date.UTC(2026, 9, 1 + (i % 28), i % 24)).toISOString() }));
  const rss = buildSiteFeed({ generatedAt: '2026-10-21T09:00:00Z', items: [...items, { id: 'untitled' }] });
  const channel = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' }).parse(rss).rss.channel;
  assert.equal(channel.item.length, 50);
  const dates = channel.item.map(item => Date.parse(item.pubDate));
  assert.deepEqual(dates, [...dates].sort((a, b) => b - a), 'newest first');
  assert.equal(channel['atom:link'].href, 'https://ealing.civiccommons.co.uk/feed.xml');
  assert.match(channel.item[0].link, /^https:\/\/ealing\.civiccommons\.co\.uk\/items\//);
  assert.equal(channel.item[0].source['#text'], 'Southall Stories');
  assert.match(rss, /Item \d+ &amp; &quot;more&quot;/);
  // A future-dated item is kept but undated, and does not jump to the top.
  const future = buildSiteFeed({ generatedAt: '2026-10-21T09:00:00Z', items: [
    { id: 'met', title: 'Priorities', source: 'Met', publishedAt: '2026-11-20T12:00:00Z' },
    { id: 'news', title: 'News', source: 'Paper', publishedAt: '2026-10-20T12:00:00Z' }
  ] });
  const futureItems = new XMLParser().parse(future).rss.channel.item;
  assert.deepEqual(futureItems.map(item => [item.title, item.pubDate ?? null]), [['News', 'Tue, 20 Oct 2026 12:00:00 GMT'], ['Priorities', null]]);
}

// Serving: a stale snapshot is rebuilt live (same path as the homepage), and a
// timeline that cannot be had is a 503, never an empty feed.
{
  const request = new Request('https://ealing.civiccommons.co.uk/feed.xml');
  const item = { id: 'a', title: 'Fresh item', source: 'Paper', publishedAt: '2026-10-21T08:00:00Z' };
  const stale = { ageMs: 3 * 60 * 60 * 1000, feed: { generatedAt: '2026-10-21T05:00:00Z', items: [{ ...item, title: 'Old item' }] } };
  let built = 0;
  const serve = req => serveCombinedFeed(req, { readFeedSnapshot: async () => stale, build: async () => { built += 1; return Response.json({ generatedAt: '2026-10-21T08:05:00Z', items: [item] }); } });
  const fresh = await serveSiteFeed(request, { serve });
  assert.equal(fresh.status, 200);
  assert.equal(built, 1, 'stale snapshot triggers a live build');
  const body = await fresh.text();
  assert.match(body, /Fresh item/);
  assert.doesNotMatch(body, /Old item/);
  assert.equal(fresh.headers.get('access-control-allow-origin'), '*');
  for (const failing of [async () => new Response('down', { status: 502 }), async () => { throw new Error('boom'); }, async () => Response.json({ items: [] })]) {
    const response = await serveSiteFeed(request, { serve: failing });
    assert.equal(response.status, 503);
  }
}

// AboutSpec and ContactSpec files exist, are well formed, and allow CORS.
const about = await readFile('public/.well-known/about.md', 'utf8');
assert.match(about, /^# Ealing Civic Commons/);
const vcard = await readFile('public/.well-known/contact.vcf', 'utf8');
assert.match(vcard, /^BEGIN:VCARD\r\nVERSION:4\.0\r\n/);
assert.match(vcard, /\r\nFN:Ealing Civic Commons\r\n/);
assert.match(vcard, /\r\nEMAIL;TYPE=work:commons@davidmarsden\.info\r\n/);
assert.match(vcard, /\r\nEND:VCARD\r\n$/);
assert.ok(vcard.split('\r\n').every(line => line.length <= 75 || /^(NOTE|URL)/.test(line)), 'vCard lines should be short or foldable fields');
const headers = await readFile('public/_headers', 'utf8');
for (const path of ['/.well-known/about.md', '/.well-known/contact.vcf']) {
  const block = headers.slice(headers.indexOf(`\n${path}\n`));
  assert.match(block.split(/\n\n/)[0], /Access-Control-Allow-Origin: \*/, `${path} allows CORS`);
}

console.log(`socialspec tests passed (${Object.keys(PUBLIC_FEEDS).length} mapped feeds)`);
