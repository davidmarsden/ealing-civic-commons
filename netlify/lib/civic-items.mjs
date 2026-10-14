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
// grows with the archive.
//
// Each entry records the etag of the item blob it was built from. The 15-minute
// archiver compares those etags with a fresh listing: entries that are missing,
// outdated or built from an older blob are reloaded (bounded per run), entries for
// blobs that no longer exist are pruned, and the index is marked `complete` only
// when every listed blob has an entry matching its current etag. Until then readers
// fall back to the authoritative full scan.
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

// Etags from list(), reads and writes are compared, so ignore quoting/weak markers.
const normaliseEtag = value => value ? String(value).replace(/^W\//, '').replace(/^"|"$/g, '') || null : null;
const timeOf = value => { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : 0; };
const listedItemKeys = listed => (listed?.blobs || []).map(blob => String(blob.key || '').replace(/^item\//, '')).filter(validItemKey);
const listedItemEtags = listed => new Map((listed?.blobs || []).map(blob => [String(blob.key || '').replace(/^item\//, ''), normaliseEtag(blob.etag)]).filter(([key]) => validItemKey(key)));

// Reads one item blob, retrying once. Throws if the store keeps failing, so a
// storage error is never mistaken for a missing record.
async function readItemBlob(blobs, key) {
  try {
    return await blobs.getWithMetadata(itemBlobKey(key), { type: 'json' });
  } catch {
    return blobs.getWithMetadata(itemBlobKey(key), { type: 'json' });
  }
}

const recordFromBlob = (key, result) => result?.data?.item && result.data.key === key ? { ...result.data, etag: normaliseEtag(result.etag) } : null;

// strict: any read failure rejects (request paths). Non-strict: failed keys are
// skipped and simply stay unindexed until a later run (backfill).
async function loadRecords(blobs, keys, { strict = true } = {}) {
  const records = [];
  for (let i = 0; i < keys.length; i += 100) {
    const loaded = await Promise.all(keys.slice(i, i + 100).map(key => {
      const read = readItemBlob(blobs, key).then(result => recordFromBlob(key, result));
      return strict ? read : read.catch(() => null);
    }));
    records.push(...loaded.filter(Boolean));
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
    etag: record.etag || null,
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
const currentEntry = (entry, etag) => entry?.v === SEARCH_INDEX_VERSION && Boolean(entry.etag) && entry.etag === etag;

// Optimistic read-modify-write so concurrent writers (the 15-minute archiver and
// the WDTK publisher) cannot silently drop each other's entries. A record never
// replaces a newer revision of the same item: a backfill that read an item just
// before a concurrent upsert must not overwrite the upsert's entry.
//
// `listing` (archiver only) is { etags: Map(key -> blob etag) }: it enables pruning
// entries whose blob no longer exists and recomputing `complete`.
async function updateSearchIndex(blobs, records, now, { listing = null } = {}) {
  try {
    for (let attempt = 0; attempt < INDEX_WRITE_ATTEMPTS; attempt += 1) {
      const { index, etag } = await readSearchIndex(blobs);
      const byKey = new Map((Array.isArray(index?.records) ? index.records : []).filter(entry => validItemKey(entry?.key)).map(entry => [entry.key, entry]));
      let changed = false;
      for (const record of records || []) {
        if (!validItemKey(record?.key)) continue;
        const existing = byKey.get(record.key);
        if (existing?.v === SEARCH_INDEX_VERSION && timeOf(existing.archivedAt) > timeOf(record.archivedAt)) continue;
        byKey.set(record.key, searchIndexEntry(record));
        changed = true;
      }
      let complete = usableIndex(index);
      if (listing) {
        // An unlisted entry may belong to a concurrent writer that stored its blob
        // after the listing, so only prune once a direct read confirms it is gone.
        for (const key of [...byKey.keys()].filter(key => !listing.etags.has(key))) {
          if (!(await readItemBlob(blobs, key))) { byKey.delete(key); changed = true; }
        }
        complete = [...listing.etags].every(([key, blobEtag]) => currentEntry(byKey.get(key), blobEtag));
      }
      if (!changed && complete === usableIndex(index)) return { size: byKey.size, complete };
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

// Listed blobs whose index entry is absent, outdated or built from an older blob,
// bounded per run so a large first backfill converges over several runs.
async function indexBackfillRecords(blobs, etags, limit = INDEX_BACKFILL_LIMIT) {
  const { index } = await readSearchIndex(blobs);
  const indexed = new Map((Array.isArray(index?.records) ? index.records : []).map(entry => [entry?.key, entry]));
  const stale = [...etags].filter(([key, blobEtag]) => !currentEntry(indexed.get(key), blobEtag)).map(([key]) => key).slice(0, limit);
  return loadRecords(blobs, stale, { strict: false });
}

export async function listArchivedItems({ limit = 40, offset = 0, sourceId = null, town = null, topic = null, q = null } = {}, { blobs = store({ consistency: 'strong' }) } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 40, 100));
  const skip = Math.max(0, Number(offset) || 0);
  const filters = { sourceId: cleanFilter(sourceId), town: cleanFilter(town), topic: cleanFilter(topic), q: cleanFilter(q, 240) };

  const { index } = await readSearchIndex(blobs).catch(error => { console.error('Civic item search index unavailable', error); return { index: null }; });
  let records = usableIndex(index) ? index.records.filter(entry => entry?.item && validItemKey(entry.key)) : null;
  let matching, page;
  const select = () => {
    matching = records.filter(record => archiveMatches(record, filters)).sort((a, b) => archiveSortTime(b) - archiveSortTime(a));
    page = matching.slice(skip, skip + max);
  };

  if (records) {
    select();
    // Read failures reject (the caller reports the archive as unavailable). A blob
    // missing behind an index entry means the index is out of date, so this request
    // is answered from the authoritative scan instead of returning a short page.
    const loaded = await loadRecords(blobs, page.map(entry => entry.key));
    if (loaded.length === page.length) {
      page = loaded;
    } else {
      console.error(`Civic item search index is stale (${page.length - loaded.length} indexed items missing); using full scan`);
      records = null;
    }
  }
  if (!records) {
    records = await authoritativeArchiveRecords(blobs);
    select();
  }

  const hasMore = skip + page.length < matching.length;
  const sources = new Map();
  for (const record of records) if (record.item?.sourceId) sources.set(record.item.sourceId, record.item.source || record.item.sourceId);
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
    nextOffset: hasMore ? skip + page.length : null,
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
    if(action!=='unchanged'){const write=await blobs.setJSON(itemBlobKey(key),record,{metadata:{sourceId:String(item.sourceId||'').slice(0,120),publishedAt:item.publishedAt||'',archivedAt:now}});record={...record,etag:normaliseEtag(write?.etag)}}
    results.push({key,action,record});
  }
  const changed=results.filter(r=>r.action!=='unchanged'),touched=changed.map(r=>r.key),manifestSize=await updateManifest(blobs,touched,now),searchIndexSize=changed.length?(await updateSearchIndex(blobs,changed.map(r=>r.record),now)).size:null;return{considered:Array.isArray(items)?items.length:0,inserted:results.filter(r=>r.action==='insert').length,updated:results.filter(r=>r.action==='update').length,unchanged:results.filter(r=>r.action==='unchanged').length,manifestSize,searchIndexSize};
}

export async function archiveItems(items, { blobs = store(), backfillLimit = INDEX_BACKFILL_LIMIT } = {}) {
  const now = new Date().toISOString();
  // A failed listing must not be mistaken for an empty archive: every item would
  // look new and be overwritten, and a partial index could be marked complete.
  const listing = await blobs.list({ prefix: 'item/' }).catch(error => { console.error('Civic item listing failed', error); return null; });
  if (!listing) return { considered: Array.isArray(items) ? items.length : 0, newCandidates: 0, stored: 0, failed: 0, manifestSize: null, archiveSize: null, searchIndexSize: null, searchIndexComplete: false, indexBackfilled: 0 };
  const etags = listedItemEtags(listing);
  const known = new Set(etags.keys());
  const candidates = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) continue;
    const key = stableItemKey(item.id);
    if (!validItemKey(key) || known.has(key)) continue;
    candidates.push({ key, record: archiveRecord(item, now) });
  }
  const writes = await Promise.all(candidates.map(({ key, record }) => blobs.setJSON(itemBlobKey(key), record, { metadata: { sourceId: String(record.item.sourceId || '').slice(0, 120), publishedAt: record.item.publishedAt || '', archivedAt: now } })
    .then(result => ({ key, record: { ...record, etag: normaliseEtag(result?.etag) }, modified: true }))
    .catch(error => ({ key, record, modified: false, error }))));
  const stored = writes.filter(write => write.modified);
  for (const write of stored) known.add(write.key);
  const manifestSize = await updateManifest(blobs, stored.map(write => write.key), now);
  const backfill = await indexBackfillRecords(blobs, etags, backfillLimit).catch(error => { console.error('Civic item index backfill failed', error); return null; });
  // New writes count towards completeness when their etag is known; otherwise the
  // next run sees them in its listing and reconciles them then.
  const expected = new Map(etags);
  for (const write of stored) if (write.record.etag) expected.set(write.key, write.record.etag);
  const searchIndex = await updateSearchIndex(blobs, [...(backfill || []), ...stored.map(write => write.record)], now, { listing: backfill ? { etags: expected } : null });
  return { considered: Array.isArray(items) ? items.length : 0, newCandidates: candidates.length, stored: stored.length, failed: writes.filter(write => write.error).length, manifestSize, archiveSize: known.size, searchIndexSize: searchIndex.size, searchIndexComplete: searchIndex.complete, indexBackfilled: backfill?.length || 0 };
}
