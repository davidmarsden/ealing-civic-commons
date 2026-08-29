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
  const blobs = store();
  const record = await blobs.get(itemBlobKey(key), {
    type: 'json',
    consistency: options.consistency || 'eventual'
  });
  if (!record?.item || record.key !== key) return null;
  return record;
}

export async function archiveItems(items) {
  const blobs = store();
  const now = new Date().toISOString();
  const manifest = await blobs.get(MANIFEST_KEY, { type: 'json', consistency: 'strong' }).catch(() => null);
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
      onlyIfNew: true,
      metadata: {
        sourceId: String(record.item.sourceId || '').slice(0, 120),
        publishedAt: record.item.publishedAt || '',
        archivedAt: now
      }
    }).then(result => ({ key, modified: Boolean(result?.modified) }))
      .catch(error => ({ key, modified: false, error }))
  ));

  for (const result of writes) {
    if (result.error) console.error(`Civic item archive write failed for ${result.key}`, result.error);
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
