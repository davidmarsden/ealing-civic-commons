#!/usr/bin/env node
// Ealing Culture adapter against a trimmed copy of the site's Events Calendar API
// (October 2026), with fetch stubbed so the test runs offline.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const events = await readFile(new URL('./fixtures/ealing-culture-events.json', import.meta.url), 'utf8');
const news = JSON.stringify([{
  id: 900, date: '2026-10-21T09:00:00', date_gmt: '2026-10-21T09:00:00', modified_gmt: '2026-10-21T09:00:00',
  link: 'https://ealingculture.org/news/community-arts-fund/', title: { rendered: 'Community arts fund opens' },
  content: { rendered: '<p>Grants for community groups.</p>' }, excerpt: { rendered: '' }, 'news-category': [], town: []
}]);
const requested = [];
let eventsStatus = 200;
globalThis.fetch = async url => {
  const { pathname } = new URL(url);
  requested.push(String(url));
  const json = body => new Response(body, { status: 200, headers: { 'x-wp-totalpages': '1' } });
  if (pathname === '/wp-json/tribe/events/v1/events') return eventsStatus === 200 ? json(events) : new Response('{}', { status: eventsStatus, statusText: 'Not Found' });
  if (pathname === '/wp-json/wp/v2/news') return json(news);
  if (pathname.startsWith('/wp-json/wp/v2/')) return json('[]');
  return new Response('not found', { status: 404, statusText: 'Not Found' });
};

const { fetchEalingCultureFeed } = await import('../netlify/functions/ealing-culture-feed.mjs');

{
  const feed = await fetchEalingCultureFeed();
  const [health] = feed.health;
  assert.deepEqual(feed.errors, []);
  assert.equal(health.ok, true, 'events and news both read');
  assert.equal(health.status, 'ok');
  assert.ok(!requested.some(url => url.includes('/wp/v2/event?')), 'the retired event post type is not requested');
  assert.match(requested.find(url => url.includes('/tribe/events/')), /start_date=\d{4}-\d{2}-\d{2}/, 'recent past events are included');
  assert.equal(feed.counts.eventsTotal, 3);

  const trunk = feed.items.find(item => item.id === 'ealing-culture:event:8726');
  assert.ok(trunk, 'a civic event is kept');
  assert.equal(trunk.url, 'https://ealingculture.org/whatson/unpacking-that-trunk-for-black-history-season/');
  assert.equal(trunk.publishedAt, '2026-10-20T11:04:29.000Z');
  assert.deepEqual(trunk.towns, ['Acton'], 'towns come from the Towns field');
  assert.deepEqual(trunk.publisherCategories, ['Heritage']);
  assert.equal(trunk.contentLabel, 'Civic / community event');

  const openMic = feed.items.find(item => item.id === 'ealing-culture:event:8666');
  assert.deepEqual(openMic.towns, ['Ealing', 'Southall'], 'several towns are split');
  assert.deepEqual(openMic.publisherCategories, ['Music', 'Word']);

  assert.ok(!feed.items.some(item => item.id === 'ealing-culture:event:8725'), 'a concert is not a civic event');
  assert.ok(feed.items.some(item => item.id === 'ealing-culture:news:900'), 'news still read from the WordPress API');
}

// The events API failing is still reported as an upstream error.
{
  eventsStatus = 404;
  const feed = await fetchEalingCultureFeed();
  assert.equal(feed.health[0].ok, false);
  assert.match(feed.health[0].error, /^collection_fetch_failed:event:404/);
  assert.ok(feed.items.some(item => item.sourceId === 'ealing-culture'), 'news still served');
}

console.log('ealing culture tests passed');
