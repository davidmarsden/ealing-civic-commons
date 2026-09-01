import { createHash } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';
import { assertEvidenceCollection, assertEvidenceObject } from './evidence.mjs';

export const EVIDENCE_STORE_NAME = 'civic-commons-evidence';
export const EVIDENCE_STORE_VERSION = 1;

export const evidenceStore = () => Netlify.context?.deploy?.context === 'production'
  ? getStore(EVIDENCE_STORE_NAME, { consistency: 'strong' })
  : getDeployStore(EVIDENCE_STORE_NAME);

const clean = value => String(value ?? '').trim();
const placeSlug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';

export const stableEvidenceKey = id => Buffer.from(clean(id), 'utf8').toString('base64url');
export const currentKey = (kind, key) => `current/${kind}/${key}`;
export const historyPrefix = (kind, key) => `history/${kind}/${key}/`;
export const snapshotKey = name => `snapshot/${placeSlug(name)}`;
export const placeManifestKey = place => `manifest/place/${placeSlug(place)}`;

function semanticValue(value) {
  if (Array.isArray(value)) return value.map(semanticValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value)
    .filter(key => !['retrievedAt', 'generatedAt', 'firstSeenAt', 'lastSeenAt', 'changedAt', 'persistedAt'].includes(key))
    .sort()
    .map(key => [key, semanticValue(value[key])]));
}

export function evidenceSemanticHash(value) {
  return createHash('sha256').update(JSON.stringify(semanticValue(value))).digest('hex');
}

function validKind(kind) {
  return kind === 'object' || kind === 'collection';
}

function padRevision(value) {
  return String(Math.max(1, Number(value) || 1)).padStart(6, '0');
}

async function readCurrent(kind, idOrKey, { isKey = false } = {}) {
  if (!validKind(kind)) return null;
  const key = isKey ? clean(idOrKey) : stableEvidenceKey(idOrKey);
  if (!key) return null;
  const record = await evidenceStore().get(currentKey(kind, key), { type: 'json' }).catch(() => null);
  if (!record || record.kind !== kind || record.key !== key) return null;
  return record;
}

async function writeCurrent(kind, value, now) {
  const validate = kind === 'object' ? assertEvidenceObject : assertEvidenceCollection;
  validate(value);

  const key = stableEvidenceKey(value.id);
  const store = evidenceStore();
  const previous = await readCurrent(kind, key, { isKey: true });
  const semanticHash = evidenceSemanticHash(value);
  const changed = !previous || previous.semanticHash !== semanticHash;
  const revision = changed ? (Number(previous?.revision) || 0) + 1 : Number(previous?.revision) || 1;

  if (previous && changed) {
    const archiveKey = `${historyPrefix(kind, key)}${padRevision(previous.revision)}-${previous.semanticHash}`;
    await store.setJSON(archiveKey, previous).catch(error => {
      console.error(`Evidence history write failed for ${kind} ${value.id}`, error);
    });
  }

  const record = {
    version: EVIDENCE_STORE_VERSION,
    kind,
    key,
    id: value.id,
    semanticHash,
    revision,
    firstSeenAt: previous?.firstSeenAt || now,
    lastSeenAt: now,
    changedAt: changed ? now : previous?.changedAt || previous?.firstSeenAt || now,
    value
  };

  await store.setJSON(currentKey(kind, key), record);
  return { record, changed, created: !previous };
}

export async function persistEvidencePayload(payload, now = new Date().toISOString()) {
  const objects = Array.isArray(payload?.objects) ? payload.objects : [];
  const collections = Array.isArray(payload?.collections) ? payload.collections : [];

  const objectWrites = [];
  for (const object of objects) objectWrites.push(await writeCurrent('object', object, now));

  const collectionWrites = [];
  for (const collection of collections) collectionWrites.push(await writeCurrent('collection', collection, now));

  const manifests = new Map();
  for (const result of collectionWrites) {
    const collection = result.record.value;
    const place = clean(collection.place);
    if (!place) continue;
    if (!manifests.has(place)) manifests.set(place, []);
    manifests.get(place).push({ id: collection.id, key: result.record.key });
  }

  const store = evidenceStore();
  for (const [place, entries] of manifests) {
    entries.sort((a, b) => a.id.localeCompare(b.id));
    await store.setJSON(placeManifestKey(place), {
      version: EVIDENCE_STORE_VERSION,
      place,
      updatedAt: now,
      collections: entries
    });
  }

  const snapshot = {
    version: EVIDENCE_STORE_VERSION,
    name: 'southall',
    persistedAt: now,
    generatedAt: payload.generatedAt || now,
    payload
  };
  await store.setJSON(snapshotKey('southall'), snapshot);

  return {
    persistedAt: now,
    objects: objectWrites.length,
    collections: collectionWrites.length,
    created: [...objectWrites, ...collectionWrites].filter(item => item.created).length,
    changed: [...objectWrites, ...collectionWrites].filter(item => item.changed && !item.created).length,
    unchanged: [...objectWrites, ...collectionWrites].filter(item => !item.changed).length,
    places: [...manifests.keys()]
  };
}

export async function getEvidenceSnapshot(name = 'southall') {
  return evidenceStore().get(snapshotKey(name), { type: 'json' }).catch(() => null);
}

export async function getEvidenceRecord(kind, id) {
  return readCurrent(kind, id);
}

export async function getPlaceEvidence(place) {
  const store = evidenceStore();
  const manifest = await store.get(placeManifestKey(place), { type: 'json' }).catch(() => null);
  if (!manifest?.collections?.length) return null;

  const records = (await Promise.all(manifest.collections.map(entry => readCurrent('collection', entry.key, { isKey: true })))).filter(Boolean);
  return {
    version: EVIDENCE_STORE_VERSION,
    place: manifest.place,
    updatedAt: manifest.updatedAt,
    collections: records.map(record => ({
      ...record.value,
      storage: {
        revision: record.revision,
        firstSeenAt: record.firstSeenAt,
        lastSeenAt: record.lastSeenAt,
        changedAt: record.changedAt,
        semanticHash: record.semanticHash
      }
    }))
  };
}
