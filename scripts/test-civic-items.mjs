#!/usr/bin/env node
import assert from 'node:assert/strict';
import { archiveItems, itemBlobKey, listArchivedItems, SEARCH_INDEX_KEY, stableItemKey, upsertMutableItems } from '../netlify/lib/civic-items.mjs';

// Minimal in-memory stand-in for a Netlify Blobs store, including conditional
// writes, plus hooks for injecting failures and concurrent writers.
function memoryStore() {
  const data = new Map();
  let etagCounter = 0;
  const read = key => data.has(key) ? JSON.parse(data.get(key).body) : null;
  const store = {
    data,
    reads: 0,
    hooks: {},
    async get(key) { store.reads += 1; await store.hooks.beforeRead?.(key); return read(key); },
    async getWithMetadata(key) { store.reads += 1; await store.hooks.beforeRead?.(key); return data.has(key) ? { data: read(key), etag: data.get(key).etag, metadata: {} } : null; },
    async setJSON(key, value, options = {}) {
      await store.hooks.beforeWrite?.(key);
      const existing = data.get(key);
      if (options.onlyIfNew && existing) return { modified: false };
      if (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = `"${++etagCounter}"`;
      data.set(key, { body: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
    async list({ prefix = '' } = {}) { return { blobs: [...data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key, etag: data.get(key).etag })) }; }
  };
  return store;
}

const item = (n, extra = {}) => ({ id: `test:${n}`, title: `Item ${n}`, summary: `Summary ${n}`, source: n % 2 ? 'Odd source' : 'Even source', sourceId: n % 2 ? 'odd' : 'even', publishedAt: new Date(Date.UTC(2026, 0, 1 + n)).toISOString(), towns: n % 3 ? ['Southall'] : ['Acton'], topics: ['planning'], ...extra });
const keyOf = n => stableItemKey(`test:${n}`);
const index = blobs => JSON.parse(blobs.data.get(SEARCH_INDEX_KEY).body);
const entry = (blobs, n) => index(blobs).records.find(record => record.key === keyOf(n));
const seed = async (blobs, from, to) => {
  for (let n = from; n <= to; n += 1) await blobs.setJSON(itemBlobKey(keyOf(n)), { version: 1, key: keyOf(n), archivedAt: '2026-02-01T00:00:00.000Z', item: item(n) });
};
const later = () => new Promise(resolve => setTimeout(resolve, 5));

// --- Backfill from a pre-existing archive with a v1 (partial) index -----------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 5);
  await blobs.setJSON(SEARCH_INDEX_KEY, { version: 1, records: [] });

  const fallback = await listArchivedItems({ limit: 2 }, { blobs });
  assert.equal(fallback.archiveSize, 5, 'reader falls back to the full scan before reconciliation');
  assert.deepEqual(fallback.records.map(r => r.item.id), ['test:5', 'test:4']);

  // Partial backfill: limited runs leave the index incomplete, then converge.
  const partial = await archiveItems([], { blobs, backfillLimit: 2 });
  assert.equal(partial.indexBackfilled, 2);
  assert.equal(partial.searchIndexComplete, false, 'a partial backfill is not complete');
  assert.equal((await listArchivedItems({}, { blobs })).archiveSize, 5, 'incomplete index is not used');
  await archiveItems([], { blobs, backfillLimit: 2 });
  const converged = await archiveItems([item(6), item(7), item(3)], { blobs, backfillLimit: 2 });
  assert.equal(converged.stored, 2, 'already-archived items are not rewritten');
  assert.equal(converged.searchIndexComplete, true);
  assert.equal(converged.searchIndexSize, 7);

  // Indexed reads match the scan while loading only the requested page.
  blobs.reads = 0;
  const page = await listArchivedItems({ limit: 2, offset: 1, sourceId: 'odd' }, { blobs });
  assert.equal(blobs.reads, 1 + 2, 'one index read plus one read per returned item');
  assert.deepEqual(page.records.map(r => r.item.id), ['test:5', 'test:3']);
  assert.equal(page.matchedSize, 4);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextOffset, 3);
  assert.equal(page.archiveSize, 7);
  assert.deepEqual(page.facets.sources.map(s => s.id), ['even', 'odd']);
  assert.equal((await listArchivedItems({ q: 'item 6' }, { blobs })).matchedSize, 1);
  assert.equal((await listArchivedItems({ town: 'Acton' }, { blobs })).matchedSize, 2);

  // A no-op run does not rewrite the index.
  const indexEtag = blobs.data.get(SEARCH_INDEX_KEY).etag;
  await archiveItems([item(1)], { blobs });
  assert.equal(blobs.data.get(SEARCH_INDEX_KEY).etag, indexEtag);
}

// --- Mutable upserts and out-of-band changes keep metadata current ------------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 3);
  await archiveItems([], { blobs });
  await later();
  const upsert = await upsertMutableItems([item(8), item(2, { title: 'Item 2 revised' })], { blobs });
  assert.equal(upsert.inserted, 1);
  assert.equal(upsert.updated, 1);
  assert.equal((await listArchivedItems({ q: 'revised' }, { blobs })).matchedSize, 1);
  assert.equal((await listArchivedItems({}, { blobs })).archiveSize, 4);

  // A blob changed without going through the index is detected by etag and reindexed.
  const record = JSON.parse(blobs.data.get(itemBlobKey(keyOf(1))).body);
  await blobs.setJSON(itemBlobKey(keyOf(1)), { ...record, item: { ...record.item, title: 'Edited out of band' } });
  const repaired = await archiveItems([], { blobs });
  assert.equal(repaired.indexBackfilled, 1);
  assert.equal(repaired.searchIndexComplete, true);
  assert.equal(entry(blobs, 1).item.title, 'Edited out of band');
}

// --- Concurrency: an upsert between backfill read and index write -------------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 3);
  await blobs.setJSON(SEARCH_INDEX_KEY, { version: 1, records: [] });
  // The archiver reads item 2 for backfill; before it writes the index, a WDTK
  // upsert revises item 2 and commits its own index entry.
  let fired = false;
  blobs.hooks.beforeRead = async key => {
    if (fired || key !== itemBlobKey(keyOf(3))) return;
    fired = true;
    await later();
    await upsertMutableItems([item(2, { title: 'Item 2 newer revision' })], { blobs });
  };
  const run = await archiveItems([], { blobs });
  blobs.hooks = {};
  assert.equal(entry(blobs, 2).item.title, 'Item 2 newer revision', 'backfill must not overwrite a newer revision');
  assert.equal(run.searchIndexComplete, false, 'listing predates the upsert, so completeness is not claimed');
  const next = await archiveItems([], { blobs });
  assert.equal(next.searchIndexComplete, true);
  assert.equal(entry(blobs, 2).item.title, 'Item 2 newer revision');
}

// --- Concurrency: index write conflict is retried without losing entries ------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 2);
  await archiveItems([], { blobs });
  let fired = false;
  blobs.hooks.beforeWrite = async key => {
    if (fired || key !== SEARCH_INDEX_KEY) return;
    fired = true;
    await upsertMutableItems([item(9)], { blobs });
  };
  await archiveItems([item(10)], { blobs });
  blobs.hooks = {};
  assert.ok(entry(blobs, 9), 'concurrent upsert entry survives the conflict');
  assert.ok(entry(blobs, 10), 'archiver entry is written on retry');
}

// --- Deleted records are pruned; stale entries never shorten a page -----------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 4);
  await archiveItems([], { blobs });
  blobs.data.delete(itemBlobKey(keyOf(4)));
  const stale = await listArchivedItems({ limit: 2 }, { blobs });
  assert.deepEqual(stale.records.map(r => r.item.id), ['test:3', 'test:2'], 'stale index entry triggers the full scan, not a short page');
  assert.equal(stale.archiveSize, 3);
  const pruned = await archiveItems([], { blobs });
  assert.equal(pruned.searchIndexComplete, true);
  assert.equal(entry(blobs, 4), undefined);
  assert.equal(index(blobs).size, 3);
}

// --- Read failures are explicit -----------------------------------------------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 3);
  await archiveItems([], { blobs });
  let failures = 0;
  blobs.hooks.beforeRead = async key => { if (key === itemBlobKey(keyOf(3)) && failures++ < 1) throw new Error('transient'); };
  assert.equal((await listArchivedItems({ limit: 1 }, { blobs })).records[0].item.id, 'test:3', 'a transient read error is retried');
  blobs.hooks.beforeRead = async key => { if (key === itemBlobKey(keyOf(3))) throw new Error('down'); };
  await assert.rejects(listArchivedItems({ limit: 1 }, { blobs }), /down/, 'a persistent read error rejects rather than dropping the record');
  blobs.hooks = {};
}

// --- Interrupted runs ----------------------------------------------------------
{
  const blobs = memoryStore();
  await seed(blobs, 1, 3);
  blobs.hooks.beforeWrite = async key => { if (key === SEARCH_INDEX_KEY) throw new Error('interrupted'); };
  const interrupted = await archiveItems([item(4)], { blobs });
  blobs.hooks = {};
  assert.equal(interrupted.stored, 1);
  assert.equal(interrupted.searchIndexComplete, false);
  assert.equal((await listArchivedItems({}, { blobs })).archiveSize, 4, 'reader falls back while the index is missing');
  const recovered = await archiveItems([], { blobs });
  assert.equal(recovered.searchIndexComplete, true);
  assert.equal(recovered.searchIndexSize, 4);

  // A failed listing must not overwrite existing items.
  const before = blobs.data.get(itemBlobKey(keyOf(1))).etag;
  const failing = { ...blobs, list: async () => { throw new Error('list failed'); } };
  const skipped = await archiveItems([item(1)], { blobs: failing });
  assert.equal(skipped.stored, 0);
  assert.equal(blobs.data.get(itemBlobKey(keyOf(1))).etag, before);
}

console.log('Civic item archive index: backfill, currency, concurrency, pruning, explicit failures and recovery OK.');
