#!/usr/bin/env node
import assert from 'node:assert/strict';
import { archiveItems, itemBlobKey, listArchivedItems, SEARCH_INDEX_KEY, stableItemKey, upsertMutableItems } from '../netlify/lib/civic-items.mjs';

// Minimal in-memory stand-in for a Netlify Blobs store, including conditional writes.
function memoryStore() {
  const data = new Map();
  let etagCounter = 0, gets = 0;
  const read = key => data.has(key) ? JSON.parse(data.get(key).body) : null;
  return {
    data,
    get gets() { return gets; },
    resetGets() { gets = 0; },
    async get(key) { gets += 1; return read(key); },
    async getWithMetadata(key) { gets += 1; return data.has(key) ? { data: read(key), etag: data.get(key).etag, metadata: {} } : null; },
    async setJSON(key, value, options = {}) {
      const existing = data.get(key);
      if (options.onlyIfNew && existing) return { modified: false };
      if (options.onlyIfMatch && existing?.etag !== options.onlyIfMatch) return { modified: false };
      const etag = `"${++etagCounter}"`;
      data.set(key, { body: JSON.stringify(value), etag });
      return { modified: true, etag };
    },
    async list({ prefix = '' } = {}) { return { blobs: [...data.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key, etag: data.get(key).etag })) }; }
  };
}

const item = (n, extra = {}) => ({ id: `test:${n}`, title: `Item ${n}`, summary: `Summary ${n}`, source: n % 2 ? 'Odd source' : 'Even source', sourceId: n % 2 ? 'odd' : 'even', publishedAt: new Date(Date.UTC(2026, 0, 1 + n)).toISOString(), towns: n % 3 ? ['Southall'] : ['Acton'], topics: ['planning'], ...extra });

const blobs = memoryStore();

// Pre-existing archive with a v1 (partial) search index, as in production before this change.
for (let n = 1; n <= 5; n += 1) {
  const key = stableItemKey(`test:${n}`);
  await blobs.setJSON(itemBlobKey(key), { version: 1, key, archivedAt: '2026-02-01T00:00:00.000Z', item: item(n) });
}
await blobs.setJSON(SEARCH_INDEX_KEY, { version: 1, records: [] });

// Before reconciliation the reader must fall back to the authoritative scan.
const fallback = await listArchivedItems({ limit: 2 }, { blobs });
assert.equal(fallback.archiveSize, 5);
assert.deepEqual(fallback.records.map(r => r.item.id), ['test:5', 'test:4']);

// One archive run writes new items and backfills the index to completeness.
const run = await archiveItems([item(6), item(7), item(3)], { blobs });
assert.equal(run.stored, 2, 'already-archived items are not rewritten');
assert.equal(run.indexBackfilled, 5);
assert.equal(run.searchIndexComplete, true);
assert.equal(run.searchIndexSize, 7);

// Indexed reads return identical results while loading only the requested page.
blobs.resetGets();
const page = await listArchivedItems({ limit: 2, offset: 1, sourceId: 'odd' }, { blobs });
assert.equal(blobs.gets, 1 + 2, 'one index read plus one read per returned item');
assert.deepEqual(page.records.map(r => r.item.id), ['test:5', 'test:3']);
assert.equal(page.matchedSize, 4);
assert.equal(page.hasMore, true);
assert.equal(page.nextOffset, 3);
assert.equal(page.archiveSize, 7);
assert.deepEqual(page.facets.sources.map(s => s.id), ['even', 'odd']);
assert.equal(page.records[0].item.summary, 'Summary 5', 'full item records come from item blobs');
assert.equal((await listArchivedItems({ q: 'item 6' }, { blobs })).matchedSize, 1);
assert.equal((await listArchivedItems({ town: 'Acton' }, { blobs })).matchedSize, 2);

// Mutable upserts keep the index complete and current.
const upsert = await upsertMutableItems([item(8), item(2, { title: 'Item 2 revised' })], { blobs });
assert.equal(upsert.inserted, 1);
assert.equal(upsert.updated, 1);
const afterUpsert = await listArchivedItems({ q: 'revised' }, { blobs });
assert.equal(afterUpsert.matchedSize, 1);
assert.equal(afterUpsert.archiveSize, 8);

// A no-op run does not rewrite the index.
const indexEtag = blobs.data.get(SEARCH_INDEX_KEY).etag;
await archiveItems([item(1)], { blobs });
assert.equal(blobs.data.get(SEARCH_INDEX_KEY).etag, indexEtag);

// A failed listing must not overwrite existing items.
const before = blobs.data.get(itemBlobKey(stableItemKey('test:1'))).etag;
const failing = { ...blobs, list: async () => { throw new Error('list failed'); } };
const skipped = await archiveItems([item(1)], { blobs: failing });
assert.equal(skipped.stored, 0);
assert.equal(blobs.data.get(itemBlobKey(stableItemKey('test:1'))).etag, before);

console.log('Civic item archive index: backfill, indexed paging, upserts and failure handling OK.');
