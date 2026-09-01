import { loadSouthallEvidence } from '../lib/southall-evidence-service.mjs';

export default async () => {
  try {
    const result = await loadSouthallEvidence();
    return new Response(JSON.stringify({
      ...result.payload,
      storage: {
        cache: result.cache,
        persistence: result.persistence || null
      }
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=900, stale-while-revalidate=3600'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', error: String(error?.message || error), generatedAt: new Date().toISOString() }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};

export const config = { path: '/api/evidence/southall' };
