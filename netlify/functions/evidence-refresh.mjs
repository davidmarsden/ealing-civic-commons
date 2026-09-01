import { loadSouthallEvidence } from '../lib/southall-evidence-service.mjs';

export default async () => {
  try {
    const result = await loadSouthallEvidence({ forceRefresh: true });
    if (result.cache?.status === 'stale') {
      throw new Error(`Evidence refresh returned stale snapshot: ${result.cache.refreshError || 'live refresh failed'}`);
    }
    if (result.persistence?.status === 'unavailable') {
      throw new Error(`Evidence persistence failed: ${result.persistence.error || 'unknown persistence error'}`);
    }
    const persistence = result.persistence || {};
    console.log(`Evidence refresh complete: ${result.payload.collections?.length || 0} collections; ${persistence.created || 0} created; ${persistence.changed || 0} changed; ${persistence.unchanged || 0} unchanged.`);
  } catch (error) {
    console.error('Scheduled evidence refresh failed', error);
    throw error;
  }
};

export const config = {
  schedule: '17 3 * * *'
};
