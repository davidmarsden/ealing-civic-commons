import { loadSouthallEvidence } from '../lib/southall-evidence-service.mjs';

export default async () => {
  try {
    const result = await loadSouthallEvidence({ forceRefresh: true });
    const persistence = result.persistence || {};
    console.log(`Evidence refresh complete: ${result.payload.collections?.length || 0} collections; ${persistence.created || 0} created; ${persistence.changed || 0} changed; ${persistence.unchanged || 0} unchanged.`);
  } catch (error) {
    console.error('Scheduled evidence refresh failed', error);
  }
};

export const config = {
  schedule: '17 3 * * *'
};
