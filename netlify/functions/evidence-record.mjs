import { getEvidenceRecord } from '../lib/evidence-store.mjs';
import { loadSouthallEvidence } from '../lib/southall-evidence-service.mjs';

export default async request => {
  const url = new URL(request.url);
  const kind = String(url.searchParams.get('kind') || '').trim();
  const id = String(url.searchParams.get('id') || '').trim();
  if (!['object', 'collection'].includes(kind) || !id || id.length > 600) {
    return new Response(JSON.stringify({ status: 'error', error: 'kind=object|collection and a valid id are required' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  try {
    let record = await getEvidenceRecord(kind, id).catch(() => null);
    if (!record) {
      await loadSouthallEvidence();
      record = await getEvidenceRecord(kind, id).catch(() => null);
    }
    if (!record) {
      return new Response(JSON.stringify({ status: 'not-found', kind, id }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' }
      });
    }
    return new Response(JSON.stringify({
      status: 'ok',
      kind,
      id,
      revision: record.revision,
      semanticHash: record.semanticHash,
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      changedAt: record.changedAt,
      value: record.value
    }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900, stale-while-revalidate=3600' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', error: String(error?.message || error) }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};

export const config = { path: '/api/evidence/record' };
