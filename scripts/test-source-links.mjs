#!/usr/bin/env node
// source-links: YouTube description links. @handle channels must be read through
// their channel-ID feed (`?user=<handle>` is a 404 for them); legacy usernames
// keep their `?user=` feed.
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/source-links.mjs';

const requested = [];
const CHANNEL = 'UCabcdefghijklmnopqrstuv';
const feedXml = videoId => `<feed><entry><yt:videoId>${videoId}</yt:videoId><media:group><media:description>Agenda https://www.ealing.gov.uk/agenda.pdf and more</media:description></media:group></entry></feed>`;
globalThis.fetch = async input => {
  const url = String(input?.url || input);
  requested.push(url);
  if (url === 'https://www.youtube.com/@eci-southall') return new Response(`<link rel="canonical" href="https://www.youtube.com/channel/${CHANNEL}">`);
  if (url === `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`) return new Response(feedXml('vid12345678'));
  if (url === 'https://www.youtube.com/feeds/videos.xml?user=EalingCouncil') return new Response(feedXml('council1234'));
  return new Response('not found', { status: 404 });
};

const call = async (videoId, sourceName) => JSON.parse((await handler({ queryStringParameters: { sourceUrl: `https://www.youtube.com/watch?v=${videoId}`, sourceName } })).body);

const handleResult = await call('vid12345678', 'ECI Southall — YouTube');
assert.deepEqual(handleResult.sourceLinks, ['https://www.ealing.gov.uk/agenda.pdf']);
assert.ok(!requested.some(url => url.includes('?user=eci-southall')), 'handle channel never uses ?user=');

const legacyResult = await call('council1234', 'Ealing Council — YouTube');
assert.deepEqual(legacyResult.sourceLinks, ['https://www.ealing.gov.uk/agenda.pdf']);

// An unresolvable handle yields no links rather than an error.
globalThis.fetch = async () => new Response('down', { status: 503 });
const failed = await call('zzz12345678', 'Cap The Towers — YouTube');
assert.deepEqual(failed.sourceLinks, []);

console.log('source-links tests passed');
