#!/usr/bin/env node
// Polite polling: small sources are reused between checks, failures are retried
// hourly with their status kept, and without Blobs every call fetches live.
import assert from 'node:assert/strict';
import { cachedSourceFetch, FAILURE_MAX_AGE_MS, SUCCESS_MAX_AGE_MS } from '../netlify/lib/source-cache.mjs';

const memory = () => {
  const data = new Map();
  return { data, get: async key => (data.has(key) ? JSON.parse(data.get(key)) : null), setJSON: async (key, value) => { data.set(key, JSON.stringify(value)); } };
};
const t0 = Date.parse('2026-11-22T12:00:00Z');
let calls = 0;
const ok = async () => { calls += 1; return [{ id: `item-${calls}` }]; };

// Success is reused for three hours, then refreshed.
const blobs = memory();
let result = await cachedSourceFetch({ blobs, key: 'a', now: t0, fetch: ok });
assert.deepEqual([result.cached, calls, result.value[0].id], [false, 1, 'item-1']);
result = await cachedSourceFetch({ blobs, key: 'a', now: t0 + SUCCESS_MAX_AGE_MS - 1, fetch: ok });
assert.deepEqual([result.cached, calls, result.value[0].id, result.checkedAt], [true, 1, 'item-1', new Date(t0).toISOString()]);
result = await cachedSourceFetch({ blobs, key: 'a', now: t0 + SUCCESS_MAX_AGE_MS, fetch: ok });
assert.deepEqual([result.cached, calls, result.value[0].id], [false, 2, 'item-2']);

// An empty but successful result is cached too.
await cachedSourceFetch({ blobs, key: 'empty', now: t0, fetch: async () => { calls += 1; return []; } });
const before = calls;
assert.deepEqual((await cachedSourceFetch({ blobs, key: 'empty', now: t0 + 1000, fetch: ok })).value, []);
assert.equal(calls, before);

// A failure is remembered for an hour, keeping the blocked flag, then retried.
const blocked = async () => { calls += 1; throw Object.assign(new Error('Blocked by a bot check'), { blocked: true }); };
const failBefore = calls;
await assert.rejects(cachedSourceFetch({ blobs, key: 'walled', now: t0, fetch: blocked }), /bot check/);
await assert.rejects(cachedSourceFetch({ blobs, key: 'walled', now: t0 + FAILURE_MAX_AGE_MS - 1, fetch: blocked }), error => error.blocked === true && error.cachedAt === new Date(t0).toISOString());
assert.equal(calls, failBefore + 1, 'no request while the failure is fresh');
result = await cachedSourceFetch({ blobs, key: 'walled', now: t0 + FAILURE_MAX_AGE_MS, fetch: ok });
assert.equal(result.cached, false, 'retried after an hour, and a recovery replaces the failure');

// Without Blobs, or with a Blobs error, every call is live.
const liveBefore = calls;
await cachedSourceFetch({ blobs: null, key: 'x', now: t0, fetch: ok });
await cachedSourceFetch({ blobs: null, key: 'x', now: t0, fetch: ok });
assert.equal(calls, liveBefore + 2);
const broken = { get: async () => { throw new Error('blobs down'); }, setJSON: async () => { throw new Error('blobs down'); } };
assert.equal((await cachedSourceFetch({ blobs: broken, key: 'y', now: t0, fetch: ok })).cached, false);

// The political feed uses it: a second run inside the window makes no requests.
const { fetchLocalPoliticalEnvironmentFeed } = await import('../netlify/functions/local-political-environment-feed.mjs');
let requests = 0;
globalThis.fetch = async () => { requests += 1; return new Response('<html><body></body></html>', { status: 200 }); };
const feedBlobs = memory();
const first = await fetchLocalPoliticalEnvironmentFeed({ blobs: feedBlobs, now: t0 });
assert.ok(requests > 0 && first.health.every(entry => entry.cached === false));
const afterFirst = requests;
const second = await fetchLocalPoliticalEnvironmentFeed({ blobs: feedBlobs, now: t0 + 60 * 60 * 1000 });
assert.equal(requests, afterFirst, 'no source is fetched again within three hours');
assert.ok(second.health.every(entry => entry.cached === true && entry.checkedAt === new Date(t0).toISOString()));

console.log('Source cache: reuse window, cached failures, live fallback and political feed polling OK.');
