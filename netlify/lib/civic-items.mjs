import { getDeployStore, getStore } from '@netlify/blobs';
import { mergeMutableRecord, sameItem } from '../../scripts/lib/mutable-archive.mjs';

export const STORE_NAME = 'civic-commons-items';
export const MANIFEST_KEY = 'manifest/recent';
export const MAX_MANIFEST_KEYS = 5000;
export const SEARCH_INDEX_KEY = 'manifest/search-index';
export const store = (options = {}) => Netlify.context?.deploy?.context === 'production'
  ? getStore(STORE_NAME, options)
  : getDeployStore(STORE_NAME);
export const stableItemKey = id => Buffer.from(String(id ?? ''), 'utf8').toString('base64url');
export const itemBlobKey = key => `item/${String(key ?? '').trim()}`;
export function validItemKey(value){const key=String(value??'').trim();return key.length>0&&key.length<=512&&/^[A-Za-z0-9_-]+$/.test(key)}
export function archiveRecord(item,archivedAt=new Date().toISOString()){const key=stableItemKey(item?.id);return{version:1,key,archivedAt,item:{...item,towns:Array.isArray(item?.towns)?item.towns:[],topics:Array.isArray(item?.topics)?item.topics:[],officialCategories:Array.isArray(item?.officialCategories)?item.officialCategories:[]}}}
export async function getArchivedItem(key,options={}){if(!validItemKey(key))return null;const blobs=store(options.consistency==='strong'?{consistency:'strong'}:{});const record=await blobs.get(itemBlobKey(key),{type:'json'});return record?.item&&record.key===key?record:null}
// The search index is a complete metadata copy of every archived item (minus the
// full record history), maintained at write time. Readers filter/sort it in memory
// and then load only the requested page of item blobs, so request cost no longer
// grows with the archive. It is used only once a reconciliation pass has confirmed
// it covers every item/ blob (`complete: true`); until then readers fall back to
// the authoritative full scan.
export const SEARCH_INDEX_VERSION = 2;
const INDEX_BACKFILL_LIMIT = 2000;
const INDEX_WRITE_ATTEMPTS = 4;

function cleanFilter(value, max = 180) { return String(value ?? '').trim().slice(0, max); }

function archiveMatches(record, { sourceId, town, topic, q }) {
  const item = record?.item;
  if (!item) return false;
  if (sourceId && item.sourceId !== sourceId) return false;
  if (town && !(item.towns || []).includes(town)) return false;
  if (topic && !(item.topics || []).includes(topic)) return false;
  if (q) {
    const haystack = `${item.title || ''}\n${item.summary || ''}\n${item.source || ''}\n${(item.towns || []).join(' ')}\n${(item.topics || []).join(' ')}`.toLowerCase();
    if (!haystack.includes(q.toLowerCase())) return false;
  }
  return true;
}

function archiveSortTime(record) {
  const published = Date.parse(record?.item?.publishedAt || '');
  if (Number.isFinite(published)) return published;
  const archived = Date.parse(record?.archivedAt || '');
  return Number.isFinite(archived) ? archived : 0;
}

const listedItemKeys = listed => (listed?.blobs || []).map(blob => String(blob.key || '').replace(/^item\//, '')).filter(validItemKey);

async function loadRecords(blobs, keys) {
  const records = [];
  for (let i = 0; i < keys.length; i += 100) {
    const loaded = await Promise.all(keys.slice(i, i + 100).map(key => blobs.get(itemBlobKey(key), { type: 'json' }).catch(() => null)));
    records.push(...loaded.filter(record => record?.item && validItemKey(record.key)));
  }
  return records;
}

async function authoritativeArchiveRecords(blobs) {
  return loadRecords(blobs, listedItemKeys(await blobs.list({ prefix: 'item/' })));
}

function searchIndexEntry(record) {
  const item = record?.item || {};
  return {
    v: SEARCH_INDEX_VERSION,
    key: record.key,
    archivedAt: record.archivedAt,
    item: {
      id: item.id,
      title: item.title || '',
      summary: item.summary || '',
      url: item.url || '',
      source: item.source || '',
      sourceId: item.sourceId || '',
      sourceClass: item.sourceClass || '',
      publishedAt: item.publishedAt || null,
      towns: Array.isArray(item.towns) ? item.towns : [],
      topics: Array.isArray(item.topics) ? item.topics : [],
      ...(Array.isArray(item.placeLinks) && item.placeLinks.length ? { placeLinks: item.placeLinks } : {})
    }
  };
}

async function readSearchIndex(blobs) {
  const result = await blobs.getWithMetadata(SEARCH_INDEX_KEY, { type: 'json' });
  return { index: result?.data || null, etag: result?.etag || null };
}

const usableIndex = index => index?.version === SEARCH_INDEX_VERSION && index.complete === true && Array.isArray(index.records);

// Optimistic read-modify-write so concurrent writers (the 15-minute archiver and
// the WDTK publisher) cannot silently drop each other's entries.
async function updateSearchIndex(blobs, records, now, { listedKeys = null } = {}) {
  try {
    for (let attempt = 0; attempt < INDEX_WRITE_ATTEMPTS; attempt += 1) {
      const { index, etag } = await readSearchIndex(blobs);
      const byKey = new Map((Array.isArray(index?.records) ? index.records : []).filter(entry => validItemKey(entry?.key)).map(entry => [entry.key, entry]));
      for (const record of records || []) if (validItemKey(record?.key)) byKey.set(record.key, searchIndexEntry(record));
      const current = entry => entry?.v === SEARCH_INDEX_VERSION;
      const complete = listedKeys
        ? listedKeys.every(key => current(byKey.get(key)))
        : usableIndex(index);
      if (!(records || []).length && complete === usableIndex(index)) return { size: byKey.size, complete };
      const body = { version: SEARCH_INDEX_VERSION, updatedAt: now, complete, size: byKey.size, records: [...byKey.values()] };
      const result = await blobs.setJSON(SEARCH_INDEX_KEY, body, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      if (result?.modified !== false) return { size: byKey.size, complete };
    }
    console.error('Civic item search index update abandoned after repeated write conflicts');
  } catch (error) {
    console.error('Civic item search index update failed', error);
  }
  return { size: null, complete: false };
}

// Keys present as item/ blobs but absent (or outdated) in the index, bounded per run
// so a large first backfill converges over several scheduled runs.
async function indexBackfillRecords(blobs, listedKeys) {
  const { index } = await readSearchIndex(blobs).catch(() => ({ index: null }));
  const indexed = new Map((Array.isArray(index?.records) ? index.records : []).map(entry => [entry?.key, entry]));
  const missing = listedKeys.filter(key => indexed.get(key)?.v !== SEARCH_INDEX_VERSION).slice(0, INDEX_BACKFILL_LIMIT);
  return loadRecords(blobs, missing);
}

export async function listArchivedItems({ limit = 40, offset = 0, sourceId = null, town = null, topic = null, q = null } = {}, { blobs = store({ consistency: 'strong' }) } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 40, 100));
  const skip = Math.max(0, Number(offset) || 0);
  const filters = { sourceId: cleanFilter(sourceId), town: cleanFilter(town), topic: cleanFilter(topic), q: cleanFilter(q, 240) };

  const { index } = await readSearchIndex(blobs).catch(() => ({ index: null }));
  const indexed = usableIndex(index);
  const records = indexed
    ? index.records.filter(entry => entry?.item && validItemKey(entry.key))
    : await authoritativeArchiveRecords(blobs);

  const sources = new Map();
  for (const record of records) if (record.item?.sourceId) sources.set(record.item.sourceId, record.item.source || record.item.sourceId);
  const matching = records.filter(record => archiveMatches(record, filters)).sort((a, b) => archiveSortTime(b) - archiveSortTime(a));
  let page = matching.slice(skip, skip + max);
  const hasMore = skip + page.length < matching.length;
  if (indexed) {
    const loaded = await Promise.all(page.map(entry => blobs.get(itemBlobKey(entry.key), { type: 'json' }).catch(() => null)));
    page = loaded.filter((record, i) => record?.item && record.key === page[i].key);
  }

  let latest = 0, updatedAt = null;
  for (const record of records) {
    const t = Date.parse(record.archivedAt || '');
    if (Number.isFinite(t) && t > latest) { latest = t; updatedAt = record.archivedAt; }
  }
  return {
    updatedAt,
    archiveSize: records.length,
    matchedSize: matching.length,
    offset: skip,
    limit: max,
    hasMore,
    nextOffset: hasMore ? skip + max : null,
    filters,
    facets: { sources: [...sources.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) },
    records: page.map(record => ({ key: record.key, archivedAt: record.archivedAt, item: record.item }))
  };
}

async function updateManifest(blobs, keysToTouch, now) {
  const manifest = await blobs.get(MANIFEST_KEY, { type: 'json' }).catch(() => null);
  const recent = new Set(Array.isArray(manifest?.keys) ? manifest.keys.filter(validItemKey) : []);
  for (const key of keysToTouch) { recent.delete(key); recent.add(key); }
  const keys = [...recent].slice(-MAX_MANIFEST_KEYS);
  await blobs.setJSON(MANIFEST_KEY, { version: 1, updatedAt: now, keys }).catch(error => console.error('Civic item manifest update failed', error));
  return keys.length;
}

export async function upsertMutableItems(items,{blobs=store({consistency:'strong'})}={}){
  const now=new Date().toISOString(),results=[];
  for(const item of Array.isArray(items)?items:[]){
    if(!item?.id)continue;
    const key=stableItemKey(item.id);if(!validItemKey(key))continue;
    // Do not convert read failures into apparent misses: doing so could overwrite
    // a versioned record and discard its provenance/revision history.
    const existing=await blobs.get(itemBlobKey(key),{type:'json'});
    const base=archiveRecord(item,now);let action='insert',record=base;
    if(existing?.item){if(sameItem(existing.item,base.item)){action='unchanged';record=existing}else{const merged=mergeMutableRecord(existing,base.item,now);action=merged.action;record={...merged.record,key,archivedAt:now}}}
    if(action!=='unchanged')await blobs.setJSON(itemBlobKey(key),record,{metadata:{sourceId:String(item.sourceId||'').slice(0,120),publishedAt:item.publishedAt||'',archivedAt:now}});
    results.push({key,action,record});
  }
  const changed=results.filter(r=>r.action!=='unchanged'),touched=changed.map(r=>r.key),manifestSize=await updateManifest(blobs,touched,now),searchIndexSize=changed.length?(await updateSearchIndex(blobs,changed.map(r=>r.record),now)).size:null;return{considered:Array.isArray(items)?items.length:0,inserted:results.filter(r=>r.action==='insert').length,updated:results.filter(r=>r.action==='update').length,unchanged:results.filter(r=>r.action==='unchanged').length,manifestSize,searchIndexSize};
}

export async function archiveItems(items, { blobs = store() } = {}) {
  const now = new Date().toISOString();
  // A failed listing must not be mistaken for an empty archive: every item would
  // look new and be overwritten, and a partial index could be marked complete.
  const listing = await blobs.list({ prefix: 'item/' }).catch(error => { console.error('Civic item listing failed', error); return null; });
  if (!listing) return { considered: Array.isArray(items) ? items.length : 0, newCandidates: 0, stored: 0, failed: 0, manifestSize: null, archiveSize: null, searchIndexSize: null, searchIndexComplete: false, indexBackfilled: 0 };
  const listedKeys = listedItemKeys(listing);
  const known = new Set(listedKeys);
  const candidates = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) continue;
    const key = stableItemKey(item.id);
    if (!validItemKey(key) || known.has(key)) continue;
    candidates.push({ key, record: archiveRecord(item, now) });
  }
  const writes = await Promise.all(candidates.map(({ key, record }) => blobs.setJSON(itemBlobKey(key), record, { metadata: { sourceId: String(record.item.sourceId || '').slice(0, 120), publishedAt: record.item.publishedAt || '', archivedAt: now } })
    .then(() => ({ key, record, modified: true }))
    .catch(error => ({ key, record, modified: false, error }))));
  const stored = writes.filter(write => write.modified);
  for (const write of stored) known.add(write.key);
  const manifestSize = await updateManifest(blobs, stored.map(write => write.key), now);
  const backfill = await indexBackfillRecords(blobs, listedKeys).catch(error => { console.error('Civic item index backfill failed', error); return null; });
  const searchIndex = await updateSearchIndex(blobs, [...(backfill || []), ...stored.map(write => write.record)], now, { listedKeys: backfill ? [...known] : null });
  return { considered: Array.isArray(items) ? items.length : 0, newCandidates: candidates.length, stored: stored.length, failed: writes.filter(write => write.error).length, manifestSize, archiveSize: known.size, searchIndexSize: searchIndex.size, searchIndexComplete: searchIndex.complete, indexBackfilled: backfill?.length || 0 };
}
