#!/usr/bin/env node
// Phase 2 (ingest once, serve many): source states, last-good substitution, the
// ingest lock, snapshot serving and a full ingest run, against the real
// @netlify/blobs client and its local server.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDeployStore, setEnvironmentContext } from '@netlify/blobs';
import { BlobsServer } from '@netlify/blobs/server';

const directory = await mkdtemp(join(tmpdir(), 'blobs-'));
const server = new BlobsServer({ directory, token: 't' });
const { port } = await server.start();
setEnvironmentContext({ siteID: 'site', deployID: '6acf3cc21c03a8f3e152cc8c', primaryRegion: 'us-east-1', token: 't', edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}` });
globalThis.Netlify = { context: { deploy: { context: 'deploy-preview' } } };

const { sourceStateFor, applySourceStates, acquireIngestLock, releaseIngestLock, readSnapshot, SNAPSHOT_KEY, LAST_RUN_KEY } = await import('../netlify/lib/feed-snapshot.mjs');
const { serveCombinedFeed } = await import('../netlify/functions/combined-feed.mjs');
const { runIngest } = await import('../netlify/functions/feed-ingest.mjs');

try {
  // --- Classification: a failure is never reported as an empty source ---------
  assert.equal(sourceStateFor({ ok: true, itemCount: 3 }), 'current');
  assert.equal(sourceStateFor({ ok: true, itemCount: 0 }), 'no-new-records');
  for (const error of ['Timed out', 'The operation was aborted', 'fetch failed', 'HTTP 503', 'HTTP 403 Forbidden', 'getaddrinfo ENOTFOUND x', 'HTTP 429']) {
    assert.equal(sourceStateFor({ ok: false, error }), 'unavailable', error);
  }
  assert.equal(sourceStateFor({ ok: false, status: 'upstream', error: 'odd' }), 'unavailable');
  for (const error of ['HTTP 404', 'Expected dated cards not found', 'Unexpected token < in JSON']) {
    assert.equal(sourceStateFor({ ok: false, error }), 'ingestion-failed', error);
  }

  // --- Last-good substitution and failure history ----------------------------
  const item = (id, sourceId, day) => ({ id, sourceId, title: id, publishedAt: `2026-10-${String(day).padStart(2, '0')}T09:00:00.000Z` });
  const first = applySourceStates({
    generatedAt: 't1', items: [item('a1', 'a', 10), item('b1', 'b', 9)],
    health: [{ id: 'a', ok: true, itemCount: 1 }, { id: 'b', ok: true, itemCount: 1 }, { id: 'c', ok: true, itemCount: 0 }]
  }, undefined, '2026-10-10T10:00:00.000Z');
  assert.deepEqual(first.feed.health.map(h => h.state), ['current', 'current', 'no-new-records']);
  assert.deepEqual(first.feed.sourceStates, { current: 2, 'no-new-records': 1 });

  const second = applySourceStates({
    generatedAt: 't2', items: [item('a2', 'a', 11)],
    health: [{ id: 'a', ok: true, itemCount: 1 }, { id: 'b', ok: false, error: 'Timed out' }, { id: 'c', ok: false, error: 'HTTP 404' }]
  }, first.state, '2026-10-11T10:00:00.000Z');
  const b = second.feed.health.find(h => h.id === 'b');
  assert.equal(b.state, 'unavailable');
  assert.equal(b.servingLastGood, 1, 'failing source keeps its last good item');
  assert.equal(b.lastSuccessAt, '2026-10-10T10:00:00.000Z');
  assert.equal(b.failingSince, '2026-10-11T10:00:00.000Z');
  assert.equal(second.feed.health.find(h => h.id === 'c').state, 'ingestion-failed');
  const restored = second.feed.items.find(i => i.id === 'b1');
  assert.equal(restored.stale, true);
  assert.equal(restored.staleSince, '2026-10-10T10:00:00.000Z');
  assert.deepEqual(second.feed.items.map(i => i.id), ['a2', 'b1'], 'restored items are merged in date order');

  const third = applySourceStates({ generatedAt: 't3', items: [], health: [{ id: 'b', ok: false, error: 'Timed out' }] }, second.state, '2026-10-12T10:00:00.000Z');
  assert.equal(third.feed.health[0].failingSince, '2026-10-11T10:00:00.000Z', 'failingSince is kept across failures');
  assert.equal(third.feed.health[0].consecutiveFailures, 2);
  const recovered = applySourceStates({ generatedAt: 't4', items: [item('b2', 'b', 13)], health: [{ id: 'b', ok: true, itemCount: 1 }] }, third.state, '2026-10-13T10:00:00.000Z');
  assert.equal(recovered.state.sources.b.consecutiveFailures, 0);
  assert.equal(recovered.state.sources.b.failingSince, null);
  assert.equal(recovered.feed.items.some(i => i.stale), false);

  // --- Lock and minimum interval ---------------------------------------------
  const blobs = getDeployStore({ name: 'lock-test', consistency: 'strong' });
  const t0 = Date.parse('2026-10-14T10:00:00.000Z');
  assert.equal((await acquireIngestLock(blobs, { runId: 'r1', now: t0 })).acquired, true);
  const busy = await acquireIngestLock(blobs, { runId: 'r2', now: t0 + 1000 });
  assert.deepEqual([busy.acquired, busy.reason], [false, 'running']);
  await releaseIngestLock(blobs, { runId: 'r1', summary: { status: 'ok' } });
  const soon = await acquireIngestLock(blobs, { runId: 'r2', now: t0 + 60_000 });
  assert.deepEqual([soon.acquired, soon.reason], [false, 'too-soon'], 'minimum interval bounds public triggers');
  assert.equal((await acquireIngestLock(blobs, { runId: 'r3', now: t0 + 6 * 60_000 })).acquired, true);
  // A crashed run's lock expires.
  assert.equal((await acquireIngestLock(blobs, { runId: 'r4', now: t0 + 6 * 60_000 + 16 * 60_000 })).acquired, true);
  const lastRun = await blobs.get(LAST_RUN_KEY, { type: 'json' });
  assert.equal(lastRun.runId, 'r4');
  // Releasing with a stale runId must not unlock someone else's run.
  await releaseIngestLock(blobs, { runId: 'r3' });
  assert.equal((await acquireIngestLock(blobs, { runId: 'r5', now: t0 + 6 * 60_000 + 17 * 60_000 })).reason, 'running');

  // --- Snapshot serving -------------------------------------------------------
  let builds = 0;
  const build = async () => { builds += 1; return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), items: [{ id: 'live' }], health: [] })); };
  const fresh = await serveCombinedFeed(new Request('http://x/'), { readFeedSnapshot: async () => ({ feed: { generatedAt: 'g', items: [{ id: 'snap' }], health: [] }, ageMs: 5 * 60_000 }), build });
  const freshBody = await fresh.json();
  assert.equal(builds, 0, 'fresh snapshot served without any upstream fetch');
  assert.deepEqual([freshBody.items[0].id, freshBody.snapshot.servedFrom, freshBody.snapshot.ageSeconds], ['snap', 'snapshot', 300]);
  const old = await (await serveCombinedFeed(new Request('http://x/'), { readFeedSnapshot: async () => ({ feed: { generatedAt: 'g', items: [], health: [] }, ageMs: 2 * 60 * 60_000 }), build })).json();
  assert.deepEqual([builds, old.items[0].id, old.snapshot.servedFrom], [1, 'live', 'live'], 'stale snapshot falls back to a live build');
  const missing = await (await serveCombinedFeed(new Request('http://x/'), { readFeedSnapshot: async () => null, build })).json();
  assert.deepEqual([builds, missing.snapshot.reason], [2, 'no snapshot']);
  const broken = await (await serveCombinedFeed(new Request('http://x/'), { readFeedSnapshot: async () => { throw new Error('blobs down'); }, build })).json();
  assert.equal(broken.snapshot.servedFrom, 'live', 'a snapshot read error falls back to live');

  // --- Full ingest run ---------------------------------------------------------
  const ingestBlobs = getDeployStore({ name: 'ingest-test', consistency: 'strong' });
  let fail = false, archived = 0, clock = t0;
  const liveBuild = async () => new Response(JSON.stringify({
    generatedAt: new Date(clock).toISOString(),
    items: fail ? [item('a2', 'a', 12)] : [item('a1', 'a', 10), item('b1', 'b', 9)],
    health: [{ id: 'a', ok: true, itemCount: 1, durationMs: 120 }, fail ? { id: 'b', ok: false, error: 'Timed out', durationMs: 9000 } : { id: 'b', ok: true, itemCount: 1, durationMs: 80 }]
  }));
  const archive = async () => { archived += 1; return { stored: 1 }; };
  const run1 = await runIngest({ origin: 'http://x', blobs: ingestBlobs, build: liveBuild, archive, now: () => clock });
  assert.equal(run1.status, 'ok');
  assert.equal(archived, 1);
  const snap1 = await readSnapshot(ingestBlobs, clock);
  assert.deepEqual(snap1.feed.items.map(i => i.id), ['a1', 'b1']);
  assert.ok(snap1.feed.ingest.runId);

  const skipped = await runIngest({ origin: 'http://x', blobs: ingestBlobs, build: liveBuild, archive, now: () => clock + 60_000 });
  assert.equal(skipped.skipped, 'too-soon', 'a duplicate trigger does no work');
  assert.equal(archived, 1);

  fail = true; clock += 15 * 60_000;
  const run2 = await runIngest({ origin: 'http://x', blobs: ingestBlobs, build: liveBuild, archive, now: () => clock });
  assert.equal(run2.status, 'ok');
  const snap2 = await readSnapshot(ingestBlobs, clock);
  const bHealth = snap2.feed.health.find(h => h.id === 'b');
  assert.deepEqual([bHealth.state, bHealth.servingLastGood], ['unavailable', 1]);
  assert.deepEqual(snap2.feed.items.map(i => [i.id, Boolean(i.stale)]), [['a2', false], ['b1', true]]);

  // A failed build leaves the previous snapshot in place and releases the lock.
  clock += 15 * 60_000;
  const failedRun = await runIngest({ origin: 'http://x', blobs: ingestBlobs, build: async () => new Response('down', { status: 502 }), archive, now: () => clock });
  assert.equal(failedRun.status, 'failed');
  assert.deepEqual((await readSnapshot(ingestBlobs, clock)).feed.items.map(i => i.id), ['a2', 'b1'], 'previous snapshot kept');
  assert.equal((await ingestBlobs.get(LAST_RUN_KEY, { type: 'json' })).status, 'failed');
  clock += 6 * 60_000;
  assert.equal((await runIngest({ origin: 'http://x', blobs: ingestBlobs, build: liveBuild, archive, now: () => clock })).status, 'ok', 'lock was released after the failure');
  assert.ok(await ingestBlobs.get(SNAPSHOT_KEY, { type: 'json' }));

  console.log('Feed snapshot: source states, last-good substitution, lock, snapshot serving and ingest runs OK.');
} finally {
  await server.stop();
  await rm(directory, { recursive: true, force: true });
}
