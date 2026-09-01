import { getPlaceEvidence } from '../lib/evidence-store.mjs';
import { loadSouthallEvidence } from '../lib/southall-evidence-service.mjs';

const cleanPlace = value => String(value ?? '').trim().toLowerCase();

function livePlacePayload(payload, place) {
  const wanted = place === 'southall' ? 'Southall' : place === 'ealing' ? 'Ealing' : null;
  if (!wanted) return null;
  const collections = (payload.collections || []).filter(collection => collection.place === wanted);
  if (!collections.length) return null;
  return {
    version: 1,
    place: wanted,
    updatedAt: payload.generatedAt,
    collections
  };
}

export default async request => {
  const url = new URL(request.url);
  const place = cleanPlace(url.searchParams.get('place'));
  if (!['southall', 'ealing'].includes(place)) {
    return new Response(JSON.stringify({ status: 'error', error: 'Supported place is required: southall or ealing' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }

  try {
    const loaded = await loadSouthallEvidence();
    const persisted = await getPlaceEvidence(place).catch(() => null);
    const payload = persisted || livePlacePayload(loaded.payload, place);
    if (!payload) {
      return new Response(JSON.stringify({ status: 'not-found', place }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' }
      });
    }
    return new Response(JSON.stringify({
      status: 'ok',
      ...payload,
      storage: { persisted: Boolean(persisted), cache: loaded.cache }
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

export const config = { path: '/api/evidence/place' };
