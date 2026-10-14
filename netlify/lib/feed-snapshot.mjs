import { getDeployStore, getStore } from '@netlify/blobs';

// Ingest once, serve many: the background ingest writes the combined feed here,
// and request handlers read it instead of fanning out to every upstream source.
export const STORE_NAME = 'civic-commons-feed';
export const SNAPSHOT_KEY = 'snapshot/combined-feed';
export const SOURCE_STATE_KEY = 'sources/state';
export const LOCK_KEY = 'ingest/lock';
export const LAST_RUN_KEY = 'ingest/last-run';
export const SNAPSHOT_MAX_AGE_MS = 60 * 60 * 1000;
const LAST_GOOD_ITEMS_PER_SOURCE = 20;

export const store = (options = {}) => Netlify.context?.deploy?.context === 'production'
  ? getStore(STORE_NAME, options)
  : getDeployStore({ name: STORE_NAME, ...options });

const timeOf = value => { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : 0; };

export async function readSnapshot(blobs, now = Date.now()) {
  const feed = await blobs.get(SNAPSHOT_KEY, { type: 'json' });
  if (!feed?.generatedAt || !Array.isArray(feed.items)) return null;
  return { feed, ageMs: Math.max(0, now - timeOf(feed.generatedAt)) };
}

export const writeSnapshot = (blobs, feed) => blobs.setJSON(SNAPSHOT_KEY, feed);
export const readSourceState = async blobs => (await blobs.get(SOURCE_STATE_KEY, { type: 'json' })) || { version: 1, sources: {} };
export const writeSourceState = (blobs, state) => blobs.setJSON(SOURCE_STATE_KEY, state);

// A failed source must never look like an absent one. Each health entry gets one
// of four states:
//   current           fetched, with records
//   no-new-records    fetched fine, nothing to show
//   unavailable       could not be reached (network, timeout, 5xx, blocked)
//   ingestion-failed  reached, but the response could not be used (e.g. the page
//                     moved or its structure changed)
const UNAVAILABLE = /time(d)?\s?out|abort|fetch failed|network|socket|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|EHOSTUNREACH|certificate|TLS|HTTP\s*(5\d\d|403|408|429)|\b(5\d\d|403|408|429)\b|unavailable|upstream|blocked|rate.?limit/i;

const FILTERED_EMPTY = /\bfilter\b|source rules|contained no supported/i;

export function sourceStateFor(entry) {
  if (entry?.ok) {
    if (Number(entry.itemCount) > 0) return 'current';
    // Adapters explain an empty success. A relevance filter that excluded
    // everything ("…matched the civic/local filter") is a genuinely empty source;
    // anything else ("…matched the expected structure", "…section was not found")
    // is a broken extraction. Unrecognised explanations count as failures, so a
    // new kind of breakage is never reported as an empty source.
    if (!entry.error || FILTERED_EMPTY.test(String(entry.error))) return 'no-new-records';
    return 'ingestion-failed';
  }
  if (['upstream', 'blocked'].includes(entry?.status)) return 'unavailable';
  return UNAVAILABLE.test(String(entry?.error || '')) ? 'unavailable' : 'ingestion-failed';
}

// Annotates every health entry with its state and history. A failing source's
// last good items are served again, marked stale with the time they were last
// confirmed, so its records do not silently vanish from the feed. Items are
// matched to entries by `itemSourceIds`, and kept per fetcher `group` too, so a
// whole-fetcher failure (reported under a synthetic group ID) can restore them.
export function applySourceStates(feed, previous = { sources: {}, groups: {} }, now = new Date().toISOString()) {
  const sources = { ...(previous?.sources || {}) };
  const groups = { ...(previous?.groups || {}) };
  const items = Array.isArray(feed?.items) ? [...feed.items] : [];
  const present = new Set(items.map(item => item?.id).filter(Boolean));
  const idsFor = entry => new Set(Array.isArray(entry.itemSourceIds) && entry.itemSourceIds.length ? entry.itemSourceIds : [entry.id]);
  const liveItemsFor = ids => items.filter(item => !item?.stale && ids.has(item?.sourceId));
  const failedGroups = new Set();
  const groupIds = new Map();

  const health = (feed?.health || []).map(entry => {
    const state = sourceStateFor(entry);
    const failed = state === 'unavailable' || state === 'ingestion-failed';
    const before = sources[entry.id] || {};
    const ids = idsFor(entry);
    if (entry.group) {
      if (!groupIds.has(entry.group)) groupIds.set(entry.group, new Set());
      for (const id of ids) groupIds.get(entry.group).add(id);
      if (failed) failedGroups.add(entry.group);
    }
    if (!failed) {
      const lastItems = liveItemsFor(ids).slice(0, LAST_GOOD_ITEMS_PER_SOURCE);
      sources[entry.id] = { lastSuccessAt: now, lastAttemptAt: now, failingSince: null, consecutiveFailures: 0, lastItems: lastItems.length ? lastItems : (before.lastItems || []) };
      return { ...entry, state, lastSuccessAt: now };
    }
    const failingSince = before.failingSince || now;
    sources[entry.id] = { ...before, lastAttemptAt: now, failingSince, consecutiveFailures: (before.consecutiveFailures || 0) + 1, lastState: state };
    const fallback = entry.fetcherFailed && entry.group ? groups[entry.group] : null;
    const candidates = [...(before.lastItems || []), ...(fallback?.lastItems || [])];
    const restored = candidates.filter(item => item?.id && !present.has(item.id));
    for (const item of restored) { present.add(item.id); items.push({ ...item, stale: true, staleSince: (fallback && !(before.lastItems || []).includes(item) ? fallback.lastSuccessAt : before.lastSuccessAt) || null }); }
    return { ...entry, state, lastSuccessAt: before.lastSuccessAt || fallback?.lastSuccessAt || null, failingSince, consecutiveFailures: sources[entry.id].consecutiveFailures, servingLastGood: restored.length };
  });

  // A fetcher group's items are refreshed only when none of its entries failed.
  for (const [group, ids] of groupIds) {
    if (failedGroups.has(group)) continue;
    const lastItems = liveItemsFor(ids).slice(0, LAST_GOOD_ITEMS_PER_SOURCE * 3);
    if (lastItems.length) groups[group] = { lastSuccessAt: now, lastItems };
  }

  items.sort((a, b) => timeOf(b?.publishedAt) - timeOf(a?.publishedAt));
  const counts = health.reduce((total, entry) => ({ ...total, [entry.state]: (total[entry.state] || 0) + 1 }), {});
  return { feed: { ...feed, items, health, sourceStates: counts }, state: { version: 1, updatedAt: now, sources, groups } };
}

// Single-runner lock for the ingest, plus a minimum interval between runs. The
// ingest endpoint is a public background-function URL, so this also bounds how
// often anyone can make it run. Some Blobs backends omit etags on reads, so the
// etag comes from a listing made before the read: a conditional write then fails
// if anything changed in between.
async function readWithEtag(blobs, key) {
  const etag = (await blobs.list({ prefix: key })).blobs.find(blob => blob.key === key)?.etag || null;
  const value = await blobs.get(key, { type: 'json' });
  return { value, etag };
}

export async function acquireIngestLock(blobs, { runId, now = Date.now(), ttlMs = 15 * 60 * 1000, minIntervalMs = 5 * 60 * 1000 } = {}) {
  const { value: lock, etag } = await readWithEtag(blobs, LOCK_KEY);
  if (lock && !lock.released && Number(lock.expiresAt) > now) return { acquired: false, reason: 'running', heldBy: lock.runId, since: lock.startedAt };
  const lastRun = await blobs.get(LAST_RUN_KEY, { type: 'json' });
  if (lastRun?.startedAt && now - timeOf(lastRun.startedAt) < minIntervalMs) return { acquired: false, reason: 'too-soon', lastStartedAt: lastRun.startedAt };
  if (lock && !etag) return { acquired: false, reason: 'lock-etag-unavailable' };
  const startedAt = new Date(now).toISOString();
  const result = await blobs.setJSON(LOCK_KEY, { runId, startedAt, expiresAt: now + ttlMs, released: false }, lock ? { onlyIfMatch: etag } : { onlyIfNew: true });
  if (result?.modified === false) return { acquired: false, reason: 'lost-race' };
  await blobs.setJSON(LAST_RUN_KEY, { runId, startedAt, status: 'running' });
  return { acquired: true, startedAt };
}

export async function releaseIngestLock(blobs, { runId, summary = {} } = {}) {
  const { value: lock, etag } = await readWithEtag(blobs, LOCK_KEY);
  if (lock?.runId === runId && etag) await blobs.setJSON(LOCK_KEY, { ...lock, released: true, releasedAt: new Date().toISOString() }, { onlyIfMatch: etag });
  const lastRun = await blobs.get(LAST_RUN_KEY, { type: 'json' });
  if (lastRun?.runId === runId) await blobs.setJSON(LAST_RUN_KEY, { ...lastRun, ...summary, finishedAt: new Date().toISOString() });
}
