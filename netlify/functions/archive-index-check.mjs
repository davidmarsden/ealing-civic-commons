import { getStore } from '@netlify/blobs';
import { archiveItems, archiveSortTime, listArchivedItems, SEARCH_INDEX_KEY, STORE_NAME, store, validItemKey } from '../lib/civic-items.mjs';

// Deploy-preview harness for verifying the archive search index against real data
// without touching production. It refuses to run in production and requires
// ARCHIVE_CHECK_TOKEN (set it for the deploy-preview context only).
//
// Production items are only ever read, through a wrapper that exposes no write
// methods. Every write goes to this deploy's own store (getDeployStore), which
// Netlify discards with the deploy.
//
//   ?action=status                     counts in production and in this deploy's store
//   ?action=seed&offset=0&limit=300    copy a chunk of production item blobs here
//   ?action=reconcile&backfill=2000    run one archiver reconciliation pass here
//   ?action=cases                      list the comparison cases for this data
//   ?action=compare&case=N             one case: indexed vs full-scan results, timings, store ops
//   ?action=walk                       page through the whole index: count, order, gaps, duplicates
//
// scripts/archive-index-preview-check.mjs drives these steps end to end.

const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const productionReadOnly = () => {
  const blobs = getStore(STORE_NAME, { consistency: 'strong' });
  return { list: options => blobs.list(options), get: (key, options) => blobs.get(key, options) };
};

// Counts store operations so each step reports its real Blobs workload.
function counted(blobs) {
  const ops = { list: 0, get: 0, getWithMetadata: 0, setJSON: 0 };
  const wrapped = {
    ops,
    list: (...args) => { ops.list += 1; return blobs.list(...args); },
    get: (...args) => { ops.get += 1; return blobs.get(...args); },
    getWithMetadata: (...args) => { ops.getWithMetadata += 1; return blobs.getWithMetadata(...args); },
    setJSON: (...args) => { ops.setJSON += 1; return blobs.setJSON(...args); }
  };
  return wrapped;
}

const itemKeys = listed => (listed?.blobs || []).map(blob => String(blob.key || '')).filter(key => key.startsWith('item/') && validItemKey(key.slice(5))).sort();

async function timed(fn) {
  const started = performance.now();
  try {
    const value = await fn();
    return { ms: Math.round(performance.now() - started), value };
  } catch (error) {
    return { ms: Math.round(performance.now() - started), error: String(error?.message || error) };
  }
}

async function status(local) {
  const [production, deploy, index] = await Promise.all([
    productionReadOnly().list({ prefix: 'item/' }),
    local.list({ prefix: 'item/' }),
    local.getWithMetadata(SEARCH_INDEX_KEY, { type: 'json' }).catch(() => null)
  ]);
  return {
    productionItems: itemKeys(production).length,
    deployItems: itemKeys(deploy).length,
    index: index?.data ? { version: index.data.version, complete: index.data.complete, size: index.data.size ?? index.data.records?.length ?? 0, updatedAt: index.data.updatedAt, bytes: JSON.stringify(index.data).length } : null
  };
}

async function seed(local, offset, limit) {
  const production = productionReadOnly();
  const keys = itemKeys(await production.list({ prefix: 'item/' }));
  const chunk = keys.slice(offset, offset + limit);
  let copied = 0, missing = 0;
  for (let i = 0; i < chunk.length; i += 50) {
    const records = await Promise.all(chunk.slice(i, i + 50).map(key => production.get(key, { type: 'json' })));
    await Promise.all(records.map((record, j) => {
      if (!record) { missing += 1; return null; }
      copied += 1;
      return local.setJSON(chunk[i + j], record);
    }));
  }
  const next = offset + chunk.length;
  return { productionItems: keys.length, offset, copied, missing, nextOffset: next < keys.length ? next : null };
}

const signature = result => ({
  archiveSize: result.archiveSize,
  matchedSize: result.matchedSize,
  hasMore: result.hasMore,
  nextOffset: result.nextOffset,
  facets: result.facets,
  keys: result.records.map(record => record.key),
  records: result.records.map(record => JSON.stringify(record.item))
});

// Cases are derived from the data (real sources, towns, topics, a title word) so
// filters are exercised with non-empty results as well as edge offsets.
async function cases(local) {
  const probe = await listArchivedItems({ limit: 100 }, { blobs: local, useIndex: false });
  const sources = probe.facets.sources.slice(0, 3).map(source => source.id);
  const town = probe.records.flatMap(record => record.item.towns || [])[0] || 'Southall';
  const topic = probe.records.flatMap(record => record.item.topics || [])[0] || 'planning';
  const word = String(probe.records[0]?.item?.title || 'council').split(/\s+/).find(part => part.length > 4) || 'council';
  return [
    { limit: 40 },
    { limit: 40, offset: 40 },
    { limit: 100, offset: 100 },
    { limit: 40, offset: Math.max(0, probe.archiveSize - 20) },
    { limit: 40, offset: probe.archiveSize + 10 },
    ...sources.map(sourceId => ({ limit: 40, sourceId })),
    { limit: 40, sourceId: sources[0], offset: 40 },
    { limit: 40, town },
    { limit: 40, topic },
    { limit: 40, q: word },
    { limit: 40, q: 'zz-no-such-term-zz' }
  ];
}

async function compare(local, query) {
  const indexedStore = counted(local), scanStore = counted(local);
  const indexed = await timed(() => listArchivedItems(query, { blobs: indexedStore }));
  const scan = await timed(() => listArchivedItems(query, { blobs: scanStore, useIndex: false }));
  const a = indexed.value ? signature(indexed.value) : null, b = scan.value ? signature(scan.value) : null;
  const differences = !a || !b ? ['error'] : Object.keys(b).filter(field => JSON.stringify(a[field]) !== JSON.stringify(b[field]));
  return { query, match: differences.length === 0, differences, matchedSize: b?.matchedSize ?? null, returned: b?.keys.length ?? null, indexed: { ms: indexed.ms, ops: indexedStore.ops, error: indexed.error }, scan: { ms: scan.ms, ops: scanStore.ops, error: scan.error } };
}

// Walks every page of the unfiltered archive via the index and checks the result
// against the store listing: every item exactly once, newest first, no gaps.
async function walk(local) {
  const listed = new Set(itemKeys(await local.list({ prefix: 'item/' })).map(key => key.slice(5)));
  const keys = [], times = [];
  let pages = 0;
  const result = await timed(async () => {
    for (let offset = 0; offset !== null && pages < 1000; pages += 1) {
      const page = await listArchivedItems({ limit: 100, offset }, { blobs: local });
      for (const record of page.records) { keys.push(record.key); times.push(archiveSortTime(record)); }
      offset = page.nextOffset;
    }
  });
  const seen = new Set(keys);
  return {
    pages,
    ms: result.ms,
    error: result.error,
    walked: keys.length,
    listed: listed.size,
    duplicates: keys.length - seen.size,
    missing: [...listed].filter(key => !seen.has(key)).length,
    unexpected: keys.filter(key => !listed.has(key)).length,
    newestFirst: times.every((time, i) => i === 0 || times[i - 1] >= time)
  };
}

export default async request => {
  const context = Netlify.context?.deploy?.context;
  const token = process.env.ARCHIVE_CHECK_TOKEN;
  if (context === 'production' || !token) return json({ error: 'Not found' }, 404);
  if (request.headers.get('x-archive-check-token') !== token) return json({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const local = counted(store({ consistency: 'strong' }));
  const action = url.searchParams.get('action') || 'status';
  try {
    if (action === 'status') return json({ deployContext: context, ...(await status(local)) });
    if (action === 'seed') {
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
      const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 300, 1000));
      const result = await timed(() => seed(local, offset, limit));
      return json({ ...result.value, ms: result.ms, error: result.error, deployStoreOps: local.ops }, result.error ? 500 : 200);
    }
    if (action === 'reconcile') {
      const backfillLimit = Math.max(1, Math.min(Number(url.searchParams.get('backfill')) || 2000, 5000));
      const result = await timed(() => archiveItems([], { blobs: local, backfillLimit }));
      return json({ ...result.value, wallMs: result.ms, error: result.error, ops: local.ops }, result.error ? 500 : 200);
    }
    if (action === 'cases') return json({ cases: await cases(local) });
    if (action === 'compare') {
      const all = await cases(local);
      const index = Number(url.searchParams.get('case'));
      if (!Number.isInteger(index) || !all[index]) return json({ error: `case must be 0-${all.length - 1}` }, 400);
      return json(await compare(local, all[index]));
    }
    if (action === 'walk') return json(await walk(local));
    return json({ error: 'Unknown action' }, 400);
  } catch (error) {
    console.error('Archive index check failed', error);
    return json({ error: String(error?.message || error) }, 500);
  }
};
