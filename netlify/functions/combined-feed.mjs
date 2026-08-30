import localFeedHandler from './feed.mjs';
import { fetchGlaFeed } from './gla-feed.mjs';
import { fetchCommunityPageFeed } from './community-page-feed.mjs';

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
  const [localResponse, gla, community] = await Promise.all([
    localFeedHandler(request),
    fetchGlaFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'gla-filtered', name: 'London City Hall / Assembly', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchCommunityPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'community-page-watch', name: 'Community page watch', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] }))
  ]);

  const local = localResponse?.ok ? await localResponse.json() : { items: [], health: [], enrichment: {} };
  const items = dedupe([...(local.items || []), ...(gla.items || []), ...(community.items || [])])
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 120);

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    items,
    health: [...(local.health || []), ...(gla.health || []), ...(community.health || [])],
    enrichment: {
      ...(local.enrichment || {}),
      cityHallEalingFilter: {
        included: gla.items?.length || 0,
        method: 'Exact locality, constituency and locally significant institution terms in City Hall RSS titles/descriptions.'
      },
      communityPageWatch: {
        included: community.items?.length || 0,
        method: 'Source-specific structured public-page extraction. A watched page returns no items rather than guessing when its expected dated-card structure is not found.'
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
