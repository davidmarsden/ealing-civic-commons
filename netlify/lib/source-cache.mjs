import { store } from './feed-snapshot.mjs';

// Polite polling for small publishers. The ingest runs every 15 minutes, but a
// party or campaign site that posts a few times a year does not need checking
// that often, and every check of a listing page also fetches its articles (up
// to 12 more requests). Frequent polling of small sites can itself trip their
// bot protection (ealinglabour.co.uk, November 2026).
//
// Each source's last result is kept in Blobs: a success is reused for
// SUCCESS_MAX_AGE_MS, a failure for FAILURE_MAX_AGE_MS (so a blocked or broken
// site is retried hourly, not every run, and keeps its failure status in
// between). Without Blobs (tests, local runs) every call fetches live.
export const SUCCESS_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const FAILURE_MAX_AGE_MS = 60 * 60 * 1000;
const PREFIX = 'source-cache/';

export function defaultSourceCacheStore() {
  try { return store(); } catch { return null; }
}

// Returns { value, checkedAt, cached } or throws the (possibly cached) error.
export async function cachedSourceFetch({ blobs, key, now = Date.now(), fetch: run, successMaxAgeMs = SUCCESS_MAX_AGE_MS, failureMaxAgeMs = FAILURE_MAX_AGE_MS }) {
  let entry = null;
  if (blobs) {
    try { entry = await blobs.get(PREFIX + key, { type: 'json' }); } catch { entry = null; }
  }
  const age = entry?.checkedAt ? now - Date.parse(entry.checkedAt) : Infinity;
  if (entry && 'value' in entry && age >= 0 && age < successMaxAgeMs) return { value: entry.value, checkedAt: entry.checkedAt, cached: true };
  if (entry?.error && age >= 0 && age < failureMaxAgeMs) {
    throw Object.assign(new Error(entry.error.message), entry.error.fields || {}, { cachedAt: entry.checkedAt });
  }

  const checkedAt = new Date(now).toISOString();
  try {
    const value = await run();
    if (blobs) await blobs.setJSON(PREFIX + key, { checkedAt, value }).catch(() => {});
    return { value, checkedAt, cached: false };
  } catch (error) {
    const fields = error?.blocked ? { blocked: true } : {};
    if (blobs) await blobs.setJSON(PREFIX + key, { checkedAt, error: { message: String(error?.message || error), fields } }).catch(() => {});
    throw error;
  }
}
