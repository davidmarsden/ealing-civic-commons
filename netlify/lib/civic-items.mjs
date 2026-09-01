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

function archiveSortTime(record) {
  const published = Date.parse(record?.item?.publishedAt || '');
  if (Number.isFinite(published)) return published;
  const archived = Date.parse(record?.archivedAt || '');
  return Number.isFinite(archived) ? archived : 0;
}

async function authoritativeArchiveRecords(blobs) {
  // `item/*` blobs are the authoritative permanent archive. The bounded
  // manifest is only a recent-key optimisation and must never define what is
  // discoverable once the archive grows beyond its 5,000-key window.
  const listed = await blobs.list({ prefix: 'item/' });
  const keys = listed.blobs
    .map(blob => String(blob.key || '').replace(/^item\//, ''))
    .filter(validItemKey);
  const records = [];
  const batchSize = 100;
  for (let cursor = 0; cursor < keys.length; cursor += batchSize) {
    const batch = keys.slice(cursor, cursor + batchSize);
    const loaded = await Promise.all(batch.map(key => blobs.get(itemBlobKey(key), { type: 'json' }).catch(() => null)));
    records.push(...loaded.filter(record => record?.item && validItemKey(record.key)));
  }
  return records;
}

export async function listArchivedItems({ limit = 40, offset = 0, sourceId = null, town = null, topic = null, q = null } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 40, 100));
  const skip = Math.max(0, Number(offset) || 0);
  const filters = {
    sourceId: cleanFilter(sourceId),
    town: cleanFilter(town),
    topic: cleanFilter(topic),
    q: cleanFilter(q, 240)
  };
  const blobs = getStore(STORE_NAME, { consistency: 'strong' });
  const records = await authoritativeArchiveRecords(blobs);
  const sources = new Map();

  // Facets describe the complete archive, not merely the current result page.
  for (const record of records) {
    if (record.item?.sourceId) sources.set(record.item.sourceId, record.item.source || record.item.sourceId);
  }

  const matching = records
    .filter(record => archiveMatches(record, filters))
    .sort((a, b) => archiveSortTime(b) - archiveSortTime(a));
  const page = matching.slice(skip, skip + max);
  const hasMore = skip + page.length < matching.length;
  let latestArchiveTime = 0;
  let updatedAt = null;
  for (const record of records) {
    const candidate = Date.parse(record.archivedAt || '');
    if (Number.isFinite(candidate) && candidate > latestArchiveTime) {
      latestArchiveTime = candidate;
      updatedAt = record.archivedAt;
    }
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
    facets: {
      sources: [...sources.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
    },
    records: page.map(record => ({ key: record.key, archivedAt: record.archivedAt, item: record.item }))
  };
}

export async function archiveItems(items) {
  const blobs = store();
  const now = new Date().toISOString();
  const manifest = await blobs.get(MANIFEST_KEY, { type: 'json' }).catch(() => null);
  const listed = await blobs.list({ prefix: 'item/' }).catch(() => ({ blobs: [] }));
  const known = new Set(listed.blobs
    .map(blob => String(blob.key || '').replace(/^item\//, ''))
    .filter(validItemKey));
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

  const recent = new Set(Array.isArray(manifest?.keys) ? manifest.keys.filter(validItemKey) : []);
  for (const result of writes) {
    if (result.error) {
      console.error(`Civic item archive write failed for ${result.key}`, result.error);
      continue;
    }
    known.add(result.key);
    recent.delete(result.key);
    recent.add(result.key);
  }

  const keys = [...recent].slice(-MAX_MANIFEST_KEYS);
  await blobs.setJSON(MANIFEST_KEY, { version: 1, updatedAt: now, keys }).catch(error => {
    console.error('Civic item manifest update failed', error);
  });

  return {
    considered: Array.isArray(items) ? items.length : 0,
    newCandidates: candidates.length,
    stored: writes.filter(result => result.modified).length,
    failed: writes.filter(result => result.error).length,
    manifestSize: keys.length,
    archiveSize: known.size
  };
}
