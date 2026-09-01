import { createHash, randomUUID } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';
import { assertEvidenceCollection, assertEvidenceObject } from './evidence.mjs';

export const EVIDENCE_STORE_NAME = 'civic-commons-evidence';
export const EVIDENCE_STORE_VERSION = 2;

export const evidenceStore = () => Netlify.context?.deploy?.context === 'production'
  ? getStore(EVIDENCE_STORE_NAME, { consistency: 'strong' })
  : getDeployStore(EVIDENCE_STORE_NAME);

const clean = value => String(value ?? '').trim();
const placeSlug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';

export const stableEvidenceKey = id => Buffer.from(clean(id), 'utf8').toString('base64url');
export const historyPrefix = (kind, key) => `history/${kind}/${key}/`;
const activePointerKey = name => `active/${placeSlug(name)}`;
const generationPrefix = generation => `generation/${generation}`;
const generationRecordKey = (generation, kind, key) => `${generationPrefix(generation)}/${kind}/${key}`;
const generationManifestKey = (generation, place) => `${generationPrefix(generation)}/manifest/place/${placeSlug(place)}`;
const generationSnapshotKey = (generation, name) => `${generationPrefix(generation)}/snapshot/${placeSlug(name)}`;

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

async function activePointer(name = 'southall') {
  return evidenceStore().get(activePointerKey(name), { type: 'json' }).catch(() => null);
}

async function readGenerationRecord(generation, kind, idOrKey, { isKey = false } = {}) {
  if (!generation || !validKind(kind)) return null;
  const key = isKey ? clean(idOrKey) : stableEvidenceKey(idOrKey);
  if (!key) return null;
  const record = await evidenceStore().get(generationRecordKey(generation, kind, key), { type: 'json' }).catch(() => null);
  if (!record || record.kind !== kind || record.key !== key) return null;
  return record;
}

async function previousRecord(pointer, kind, value) {
  if (!pointer?.generation) return null;
  return readGenerationRecord(pointer.generation, kind, value.id);
}

function buildRecord(kind, value, previous, now) {
  const validate = kind === 'object' ? assertEvidenceObject : assertEvidenceCollection;
  validate(value);

  const key = stableEvidenceKey(value.id);
  const semanticHash = evidenceSemanticHash(value);
  const changed = !previous || previous.semanticHash !== semanticHash;
  const revision = changed ? (Number(previous?.revision) || 0) + 1 : Number(previous?.revision) || 1;

  return {
    record: {
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
    },
    changed,
    created: !previous,
    previous
  };
}

async function archivePrevious(result) {
  if (!result.previous || !result.changed) return;
  const { previous } = result;
  const archiveKey = `${historyPrefix(previous.kind, previous.key)}${padRevision(previous.revision)}-${previous.semanticHash}`;
  // History preservation is part of the transaction contract. If this write
  // fails, abort before the new generation can become active.
  await evidenceStore().setJSON(archiveKey, previous);
}

export async function persistEvidencePayload(payload, now = new Date().toISOString()) {
  const objects = Array.isArray(payload?.objects) ? payload.objects : [];
  const collections = Array.isArray(payload?.collections) ? payload.collections : [];
  const previousPointer = await activePointer('southall');
  const generation = `${Date.now()}-${randomUUID()}`;
  const store = evidenceStore();

  const objectWrites = [];
  for (const object of objects) {
    const previous = await previousRecord(previousPointer, 'object', object);
    objectWrites.push(buildRecord('object', object, previous, now));
  }

  const collectionWrites = [];
  for (const collection of collections) {
    const previous = await previousRecord(previousPointer, 'collection', collection);
    collectionWrites.push(buildRecord('collection', collection, previous, now));
  }

  // Preserve every superseded record before staging the candidate generation.
  // Any failure here leaves the currently active generation untouched.
  for (const result of [...objectWrites, ...collectionWrites]) await archivePrevious(result);

  // Stage immutable generation-scoped records. Readers never see these until
  // the single active pointer below is switched after all writes succeed.
  for (const result of objectWrites) {
    await store.setJSON(generationRecordKey(generation, 'object', result.record.key), result.record);
  }
  for (const result of collectionWrites) {
    await store.setJSON(generationRecordKey(generation, 'collection', result.record.key), result.record);
  }

  const manifests = new Map();
  for (const result of collectionWrites) {
    const collection = result.record.value;
    const place = clean(collection.place);
    if (!place) continue;
    if (!manifests.has(place)) manifests.set(place, []);
    manifests.get(place).push({ id: collection.id, key: result.record.key });
  }

  for (const [place, entries] of manifests) {
    entries.sort((a, b) => a.id.localeCompare(b.id));
    await store.setJSON(generationManifestKey(generation, place), {
      version: EVIDENCE_STORE_VERSION,
      generation,
      place,
      updatedAt: now,
      collections: entries
    });
  }

  const snapshot = {
    version: EVIDENCE_STORE_VERSION,
    generation,
    name: 'southall',
    persistedAt: now,
    generatedAt: payload.generatedAt || now,
    payload
  };
  await store.setJSON(generationSnapshotKey(generation, 'southall'), snapshot);

  // Atomic publication boundary: until this single pointer write succeeds,
  // every reader remains on the complete previous generation.
  await store.setJSON(activePointerKey('southall'), {
    version: EVIDENCE_STORE_VERSION,
    name: 'southall',
    generation,
    persistedAt: now
  });

  return {
    generation,
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
  const pointer = await activePointer(name);
  if (!pointer?.generation) return null;
  return evidenceStore().get(generationSnapshotKey(pointer.generation, name), { type: 'json' }).catch(() => null);
}

export async function getEvidenceRecord(kind, id) {
  const pointer = await activePointer('southall');
  if (!pointer?.generation) return null;
  return readGenerationRecord(pointer.generation, kind, id);
}

export async function getPlaceEvidence(place) {
  const store = evidenceStore();
  const pointer = await activePointer('southall');
  if (!pointer?.generation) return null;

  const manifest = await store.get(generationManifestKey(pointer.generation, place), { type: 'json' }).catch(() => null);
  if (!manifest?.collections?.length) return null;

  const records = (await Promise.all(manifest.collections.map(entry =>
    readGenerationRecord(pointer.generation, 'collection', entry.key, { isKey: true })
  ))).filter(Boolean);

  // A generation manifest is only published after all referenced records are
  // staged. Treat an incomplete read as unavailable rather than serving a mix.
  if (records.length !== manifest.collections.length) return null;

  return {
    version: EVIDENCE_STORE_VERSION,
    generation: pointer.generation,
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
