import localFeedHandler from './feed.mjs';
import { fetchGlaFeed } from './gla-feed.mjs';

function canonical(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(value).trim();
  }
}

function dedupe(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = canonical(item.canonicalUrl) || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async request => {
  const [localResponse, gla] = await Promise.all([
    localFeedHandler(request),
    fetchGlaFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'gla-filtered', name: 'London City Hall / Assembly', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] }))
  ]);

  const local = localResponse?.ok ? await localResponse.json() : { items: [], health: [], enrichment: {} };
  const items = dedupe([...(local.items || []), ...(gla.items || [])])
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 100);

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    items,
    health: [...(local.health || []), ...(gla.health || [])],
    enrichment: {
      ...(local.enrichment || {}),
      cityHallEalingFilter: {
        included: gla.items?.length || 0,
        method: 'Exact locality, constituency and locally significant institution terms in City Hall RSS titles/descriptions.'
      }
    }
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
