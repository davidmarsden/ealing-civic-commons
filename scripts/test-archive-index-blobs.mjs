#!/usr/bin/env node
// End-to-end check of the archive index and the deploy-preview harness against the
// real @netlify/blobs client and its local BlobsServer (real etags, listings and
// conditional writes), with a "production" site store and an isolated deploy store.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDeployStore, getStore, setEnvironmentContext } from '@netlify/blobs';
import { BlobsServer } from '@netlify/blobs/server';

const ITEMS = Number(process.env.ARCHIVE_TEST_ITEMS || 600);
const directory = await mkdtemp(join(tmpdir(), 'blobs-'));
const token = 'local-token';
const server = new BlobsServer({ directory, token });
const { port } = await server.start();
setEnvironmentContext({ siteID: 'site', deployID: '6acf3cc21c03a8f3e152cc8c', primaryRegion: 'us-east-1', token, edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}` });

globalThis.Netlify = { context: { deploy: { context: 'deploy-preview' } } };
process.env.ARCHIVE_CHECK_TOKEN = 'check-token';
const { STORE_NAME, stableItemKey, itemBlobKey, archiveRecord, upsertMutableItems } = await import('../netlify/lib/civic-items.mjs');
const { default: check } = await import('../netlify/functions/archive-index-check.mjs');

const call = async (query, headers = { 'x-archive-check-token': 'check-token' }) => {
  const response = await check(new Request(`http://localhost/.netlify/functions/archive-index-check?${query}`, { headers }));
  return { status: response.status, body: await response.json() };
};

try {
  // Seed "production" with items, including deliberate publishedAt ties.
  const production = getStore(STORE_NAME);
  const sources = ['council', 'news', 'wdtk', 'police'];
  const towns = ['Southall', 'Acton', 'Ealing', 'Hanwell'];
  for (let n = 0; n < ITEMS; n += 1) {
    const item = { id: `prod:${n}`, title: `Record ${n} about ${towns[n % 4]} council housing`, summary: `Summary ${n}`, source: sources[n % 4], sourceId: sources[n % 4], publishedAt: new Date(Date.UTC(2026, 0, 1 + Math.floor(n / 3))).toISOString(), towns: [towns[n % 4]], topics: [n % 2 ? 'housing' : 'planning'] };
    const record = archiveRecord(item, '2026-03-01T00:00:00.000Z');
    await production.setJSON(itemBlobKey(record.key), record);
  }
  const productionEtags = JSON.stringify((await production.list({ prefix: 'item/' })).blobs);

  // Access control.
  assert.equal((await call('action=status', {})).status, 401);
  globalThis.Netlify.context.deploy.context = 'production';
  assert.equal((await call('action=status')).status, 404, 'refuses to run in production');
  globalThis.Netlify.context.deploy.context = 'deploy-preview';

  let status = (await call('action=status')).body;
  assert.equal(status.productionItems, ITEMS);
  assert.equal(status.deployItems, 0);

  for (let offset = 0; offset !== null;) {
    const seeded = (await call(`action=seed&offset=${offset}&limit=250`)).body;
    assert.equal(seeded.missing, 0);
    offset = seeded.nextOffset;
  }
  status = (await call('action=status')).body;
  assert.equal(status.deployItems, ITEMS);
  assert.equal(status.index, null);

  // Partial backfill passes converge to a complete index.
  const passes = [];
  for (let i = 0; i <= Math.ceil(ITEMS / 250); i += 1) {
    const pass = (await call('action=reconcile&backfill=250')).body;
    passes.push({ backfilled: pass.indexBackfilled, complete: pass.searchIndexComplete, ms: pass.wallMs, ops: pass.ops });
    if (pass.searchIndexComplete) break;
  }
  assert.equal(passes.at(-1).complete, true, 'index completes');
  assert.equal(passes.length, Math.ceil(ITEMS / 250));
  const steady = (await call('action=reconcile')).body;
  assert.equal(steady.indexBackfilled, 0);
  assert.equal(steady.searchIndexWritten, false, 'steady state does not rewrite the index');
  assert.deepEqual(steady.ops, { list: 2, get: 0, getWithMetadata: 2, setJSON: 0 }, 'steady state: item listing, index etag listing and two index reads; no writes');

  // A concurrent mutable update through the real client stays current.
  const deploy = getDeployStore({ name: STORE_NAME, consistency: 'strong' });
  await upsertMutableItems([{ id: 'prod:5', title: 'Revised record five', summary: 'x', source: 'news', sourceId: 'news', publishedAt: '2026-01-02T00:00:00.000Z', towns: ['Acton'], topics: ['planning'] }], { blobs: deploy });
  const afterUpsert = (await call('action=reconcile')).body;
  assert.equal(afterUpsert.searchIndexComplete, true, 'real write etags match listing etags');
  assert.equal(afterUpsert.indexBackfilled, 0, 'upsert entry already current');

  // Indexed and full-scan results agree for every case.
  const { cases } = (await call('action=cases')).body;
  const comparisons = [];
  for (let i = 0; i < cases.length; i += 1) {
    const result = (await call(`action=compare&case=${i}`)).body;
    assert.equal(result.match, true, `case ${JSON.stringify(result.query)} differs: ${result.differences}`);
    comparisons.push(result);
  }
  const walk = (await call('action=walk')).body;
  assert.equal(walk.walked, ITEMS);
  assert.equal(walk.duplicates, 0);
  assert.equal(walk.missing, 0);
  assert.equal(walk.newestFirst, true);

  assert.equal(JSON.stringify((await production.list({ prefix: 'item/' })).blobs), productionEtags, 'production items untouched');
  assert.equal(await production.get('manifest/search-index'), null, 'no index written to production');

  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  console.log(JSON.stringify({
    items: ITEMS,
    backfillPasses: passes,
    steadyStateReconcile: { ms: steady.wallMs, ops: steady.ops, timings: steady.timings },
    compareMedianMs: { indexed: median(comparisons.map(c => c.indexed.ms)), scan: median(comparisons.map(c => c.scan.ms)) },
    compareOps: { indexed: comparisons[0].indexed.ops, scan: comparisons[0].scan.ops },
    walk
  }, null, 2));
  console.log('Archive index against local Netlify Blobs: isolation, backfill, steady state, equivalence and pagination OK.');
} finally {
  await server.stop();
  await rm(directory, { recursive: true, force: true });
}
