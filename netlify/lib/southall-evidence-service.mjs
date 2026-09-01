import { buildProbe } from '../functions/ealing-data-probe.mjs';
import { normalizeEalingProbe } from './ealing-evidence.mjs';
import { getEvidenceSnapshot, persistEvidencePayload } from './evidence-store.mjs';

export const DEFAULT_EVIDENCE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function snapshotAgeMs(snapshot, now = Date.now()) {
  const stamp = Date.parse(snapshot?.persistedAt || snapshot?.generatedAt || '');
  return Number.isFinite(stamp) ? Math.max(0, now - stamp) : Infinity;
}

export async function loadSouthallEvidence({ forceRefresh = false, maxAgeMs = DEFAULT_EVIDENCE_MAX_AGE_MS } = {}) {
  const snapshot = await getEvidenceSnapshot('southall').catch(() => null);
  const ageMs = snapshotAgeMs(snapshot);

  if (!forceRefresh && snapshot?.payload && ageMs <= maxAgeMs) {
    return {
      payload: snapshot.payload,
      cache: { status: 'hit', persistedAt: snapshot.persistedAt, ageMs }
    };
  }

  try {
    const probe = await buildProbe();
    const payload = normalizeEalingProbe(probe);
    let persistence = null;
    try {
      persistence = await persistEvidencePayload(payload);
    } catch (error) {
      console.error('Evidence persistence failed; serving fresh live payload', error);
      persistence = { status: 'unavailable', error: String(error?.message || error) };
    }
    return {
      payload,
      cache: { status: snapshot?.payload ? 'refreshed' : 'miss', previousAgeMs: Number.isFinite(ageMs) ? ageMs : null },
      persistence
    };
  } catch (error) {
    if (snapshot?.payload) {
      console.error('Evidence refresh failed; serving stale persisted snapshot', error);
      return {
        payload: snapshot.payload,
        cache: {
          status: 'stale',
          persistedAt: snapshot.persistedAt,
          ageMs,
          refreshError: String(error?.message || error)
        }
      };
    }
    throw error;
  }
}
