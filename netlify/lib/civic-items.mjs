import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'civic-commons-items';
export const MANIFEST_KEY = 'manifest/recent';
export const MAX_MANIFEST_KEYS = 5000;

export const store = () => getStore(STORE_NAME);
export const stableItemKey = id => Buffer.from(String(id ?? ''), 'utf8').toString('base64url');
export const itemBlobKey = key => `item/${String(key ?? '').trim()}`;

export function validItemKey(value) {
  const key = String(value ?? '').trim();
  return key.length > 0 && key.length <= 512 && /^[A-Za-z0-9_-]+$/.test(key);
}

export function archiveRecord(item, archivedAt = new Date().toISOString()) {
  const key = stableItemKey(item?.id);
  return {
    version: 1,
    key,
    archivedAt,
    item: {
      id: item?.id ?? null,
      sourceId: item?.sourceId ?? null,
      source: item?.source ?? null,
      sourceClass: item?.sourceClass ?? null,
      sourceHomepage: item?.sourceHomepage ?? null,
      title: item?.title ?? 'Untitled',
      url: item?.url ?? item?.sourceHomepage ?? null,
      canonicalUrl: item?.canonicalUrl ?? null,
      summary: item?.summary ?? '',
      publishedAt: item?.publishedAt ?? null,
      towns: Array.isArray(item?.towns) ? item.towns : [],
      topics: Array.isArray(item?.topics) ? item.topics : [],
      officialCategories: Array.isArray(item?.officialCategories) ? item.officialCategories : [],
      topicProvenance: item?.topicProvenance ?? null,
      derived: Boolean(item?.derived),
      derivedFrom: item?.derivedFrom ?? null
    }
  };
}

export async function getArchivedItem(key, options = {}) {
  if (!validItemKey(key)) return null;
  const blobs = options.consistency === 'strong' ? getStore(STORE_NAME, { consistency: 'strong' }) : store();
  const record = await blobs.get(itemBlobKey(key), { type: 'json' });
  if (!record?.item || record.key !== key) return null;
  return record;
}

function cleanFilter(value, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

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

export async function listArchivedItems({ limit = 40, offset = 0, sourceId = null, town = null, topic = null, q = null } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 40, 100));
  const skip = Math.max(0, Math.min(Number(offset) || 0, MAX_MANIFEST_KEYS));
  const filters = {
    sourceId: cleanFilter(sourceId),
    town: cleanFilter(town),
    topic: cleanFilter(topic),
    q: cleanFilter(q, 240)
  };
  const blobs = getStore(STORE_NAME, { consistency: 'strong' });
  const manifest = await blobs.get(MANIFEST_KEY, { type: 'json' });
  const keys = (Array.isArray(manifest?.keys) ? manifest.keys : []).filter(validItemKey).reverse();
  const results = [];
  const sources = new Map();
  let matched = 0;
  let exhausted = true;
  const batchSize = 80;

  for (let cursor = 0; cursor < keys.length; cursor += batchSize) {
    const batch = keys.slice(cursor, cursor + batchSize);
    const records = await Promise.all(batch.map(key => blobs.get(itemBlobKey(key), { type: 'json' }).catch(() => null)));
    for (const record of records) {
      if (record?.item?.sourceId) sources.set(record.item.sourceId, record.item.source || record.item.sourceId);
      if (!archiveMatches(record, filters)) continue;
      if (matched++ < skip) continue;
      if (results.length < max) {
        results.push({
          key: record.key,
          archivedAt: record.archivedAt,
          item: record.item
        });
        continue;
      }
      exhausted = false;
      break;
    }
    if (!exhausted) break;
  }

  return {
    updatedAt: manifest?.updatedAt || null,
    archiveSize: keys.length,
    offset: skip,
    limit: max,
    hasMore: !exhausted,
    nextOffset: !exhausted ? skip + results.length : null,
    filters,
    facets: {
      sources: [...sources.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
    },
    records: results
  };
}

export async function archiveItems(items) {
  const blobs = store();
  const now = new Date().toISOString();
  const manifest = await blobs.get(MANIFEST_KEY, { type: 'json' }).catch(() => null);
  const known = new Set(Array.isArray(manifest?.keys) ? manifest.keys.filter(validItemKey) : []);
  const candidates = [];

  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) continue;
    const key = stableItemKey(item.id);
    if (!validItemKey(key) || known.has(key)) continue;
    candidates.push({ key, record: archiveRecord(item, now) });
  }

  const writes = await Promise.all(candidates.map(({ key, record }) =>
    blobs.setJSON(itemBlobKey(key), record, {
      metadata: {
        sourceId: String(record.item.sourceId || '').slice(0, 120),
        publishedAt: record.item.publishedAt || '',
        archivedAt: now
      }
    }).then(() => ({ key, modified: true }))
      .catch(error => ({ key, modified: false, error }))
  ));

  for (const result of writes) {
    if (result.error) {
      console.error(`Civic item archive write failed for ${result.key}`, result.error);
      continue;
    }
    known.add(result.key);
  }

  const keys = [...known].slice(-MAX_MANIFEST_KEYS);
  await blobs.setJSON(MANIFEST_KEY, { version: 1, updatedAt: now, keys }).catch(error => {
    console.error('Civic item manifest update failed', error);
  });

  return {
    considered: Array.isArray(items) ? items.length : 0,
    newCandidates: candidates.length,
    stored: writes.filter(result => result.modified).length,
    failed: writes.filter(result => result.error).length,
    manifestSize: keys.length
  };
}
