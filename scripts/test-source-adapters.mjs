#!/usr/bin/env node
// Source adapters against trimmed copies of the publishers' real pages (October
// 2026), with fetch stubbed so the test runs offline.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const fixture = name => readFile(new URL(`./data/source-fixtures/${name}`, import.meta.url), 'utf8');
const LIBDEMS_ARTICLE = 'https://www.ealinglibdems.org.uk/news/article/joint-statement-ealing-lib-dems-and-ealing-greens-on-walpole-park-theatre-plans';
const LAGER_POST = 'https://lagercan.co.uk/celebrating-our-litter-heroes-at-the-lalas-2026/';
const pages = new Map([
  ['https://lagercan.co.uk/blog/', await fixture('lagercan-blog.html')],
  [LAGER_POST, await fixture('lagercan-post.html')],
  ['https://www.ealinglibdems.org.uk/', `<html><body><a href="/news/article/joint-statement-ealing-lib-dems-and-ealing-greens-on-walpole-park-theatre-plans">Joint Statement: Ealing Lib Dems and Ealing Greens on Walpole Park Theatre Plans</a><a href="/our-councillors">Our Councillors page</a></body></html>`],
  [LIBDEMS_ARTICLE, await fixture('libdems-article.html')],
  ['https://southallcommunityalliance.com/feed/', await fixture('sca-feed.xml')]
]);
const requested = [];
globalThis.fetch = async url => {
  requested.push(String(url));
  const body = pages.get(String(url));
  return body === undefined ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 });
};

const { fetchLocalPoliticalEnvironmentFeed } = await import('../netlify/functions/local-political-environment-feed.mjs');
const { items, health } = await fetchLocalPoliticalEnvironmentFeed();
const bySource = id => items.filter(item => item.sourceId === id);
const healthFor = id => health.find(entry => entry.id === id);

// LAGER Can: /slug/ permalinks, scoped to the posts container.
const lager = bySource('lager-can-blog');
assert.ok(lager.some(item => item.url === LAGER_POST && item.publishedAt === '2026-06-23T20:43:58.000Z'), 'LAGER Can post found and dated from <time datetime>');
for (const nav of ['/meet-the-team/', '/press-2026/', '/dofe/', '/author/']) {
  assert.ok(!requested.some(url => url.startsWith(`https://lagercan.co.uk${nav}`)), `menu page ${nav} is not treated as a post`);
}
assert.ok(healthFor('lager-can-blog').ok && healthFor('lager-can-blog').itemCount >= 1);

// Ealing Lib Dems: date from the `text-aux` element.
const libdems = bySource('ealing-libdems-news');
assert.equal(libdems.length, 1);
assert.equal(libdems[0].publishedAt, '2026-09-16T00:00:00.000Z');

// Southall Community Alliance: RSS, with the page-scrape ID scheme preserved.
const sca = bySource('southall-community-alliance');
assert.equal(sca.length, 2);
const awards = sca.find(item => item.title === 'SCA hosts the fourth annual Southall Community Awards');
assert.equal(awards.publishedAt, '2026-10-02T12:53:24.000Z');
assert.equal(awards.id, `southall-community-alliance:${createHash('sha256').update(awards.url).digest('hex').slice(0, 16)}`, 'IDs match previously archived items');
assert.ok(!/\[…\]|\[&#8230;\]/.test(awards.summary), 'feed truncation marker removed');
assert.deepEqual(awards.towns, ['Southall']);
assert.ok(!requested.includes('https://southallcommunityalliance.com/'), 'the page is no longer scraped');

// Norwood Green is retired, not silently failing.
assert.equal(healthFor('norwood-green-residents'), undefined);

// YouTube @handles resolve to channel IDs, with caching and honest failures.
const { channelIdFromPage, resolveYoutubeHandle } = await import('../netlify/lib/youtube-channels.mjs');
assert.equal(channelIdFromPage('<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">'), 'UCabcdefghijklmnopqrstuv');
assert.equal(channelIdFromPage('{"metadata":{"externalId":"UC0123456789abcdefghij_-"}}'), 'UC0123456789abcdefghij_-');
assert.equal(channelIdFromPage('<html>consent page</html>'), null);
const store = new Map();
const cache = { get: async key => store.get(key) ?? null, setJSON: async (key, value) => { store.set(key, value); } };
let calls = 0;
const page = async () => { calls += 1; return new Response('<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">'); };
assert.equal(await resolveYoutubeHandle('@test-handle', { cache, fetchImpl: page }), 'UCabcdefghijklmnopqrstuv');
assert.equal(await resolveYoutubeHandle('test-handle', { cache, fetchImpl: page }), 'UCabcdefghijklmnopqrstuv');
assert.equal(calls, 1, 'resolved IDs are cached');
await assert.rejects(resolveYoutubeHandle('gone-channel', { fetchImpl: async () => new Response('', { status: 404 }) }), /HTTP 404/);
// A cached ID survives a temporarily unreachable channel page.
store.set('youtube/handle/flaky', { channelId: 'UCzzzzzzzzzzzzzzzzzzzzzz', resolvedAt: new Date(0).toISOString() });
assert.equal(await resolveYoutubeHandle('flaky', { cache, fetchImpl: async () => new Response('', { status: 503 }) }), 'UCzzzzzzzzzzzzzzzzzzzzzz');

console.log('Source adapters: LAGER Can, Lib Dems, Southall Community Alliance RSS, Norwood retirement and YouTube handles OK.');
