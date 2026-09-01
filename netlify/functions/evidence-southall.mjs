import { buildProbe } from './ealing-data-probe.mjs';
import { normalizeEalingProbe } from '../lib/ealing-evidence.mjs';

export default async () => {
  try {
    const probe = await buildProbe();
    const payload = normalizeEalingProbe(probe);
    return new Response(JSON.stringify(payload), {
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
