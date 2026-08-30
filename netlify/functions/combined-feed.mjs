import localFeedHandler from './feed.mjs';
import { fetchGlaFeed } from './gla-feed.mjs';
import { fetchCommunityPageFeed } from './community-page-feed.mjs';
import { fetchLivingPageFeed } from './living-page-feed.mjs';
import { fetchMetEalingFeed } from './met-ealing-feed.mjs';
import { fetchEalingCitizensFeed } from './ealing-citizens-feed.mjs';
import { fetchFilteredVideoFeed } from './filtered-video-feed.mjs';
import { fetchFaithCommunityFeed } from './faith-community-feed.mjs';

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
  const [localResponse, gla, community, living, met, citizens, videos, faith] = await Promise.all([
    localFeedHandler(request),
    fetchGlaFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'gla-filtered', name: 'London City Hall / Assembly', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchCommunityPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'community-page-watch', name: 'Community page watch', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchLivingPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'living-page-watch', name: 'Living publication pages', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchMetEalingFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'met-ealing', name: 'Metropolitan Police — Ealing', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchEalingCitizensFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'ealing-citizens', name: 'Ealing Citizens / Citizens UK', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchFilteredVideoFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'filtered-video', name: 'Filtered civic video sources', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchFaithCommunityFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'faith-community', name: 'Faith and community sources', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] }))
  ]);

  const local = localResponse?.ok ? await localResponse.json() : { items: [], health: [], enrichment: {} };
  const items = dedupe([...(local.items || []), ...(gla.items || []), ...(community.items || []), ...(living.items || []), ...(met.items || []), ...(citizens.items || []), ...(videos.items || []), ...(faith.items || [])])
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 220);

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    items,
    health: [...(local.health || []), ...(gla.health || []), ...(community.health || []), ...(living.health || []), ...(met.health || []), ...(citizens.health || []), ...(videos.health || []), ...(faith.health || [])],
    enrichment: {
      ...(local.enrichment || {}),
      cityHallEalingFilter: { included: gla.items?.length || 0, method: 'Exact locality, constituency and locally significant institution terms in City Hall RSS titles/descriptions.' },
      communityPageWatch: { included: community.items?.length || 0, method: 'Source-specific structured public-page extraction. A watched page returns no items rather than guessing when its expected dated-card structure is not found.' },
      livingPublicationWatch: { included: living.items?.length || 0, method: 'Content-hashed snapshots of configured living publication sections. No publication date is invented when the publisher does not expose one.' },
      metropolitanPoliceEaling: { included: met.items?.length || 0, method: 'Official Met newsroom items filtered for explicit Ealing-area terms plus content-hashed current priorities for Southall/Norwood Green Safer Neighbourhood teams.' },
      ealingCitizens: { included: citizens.items?.length || 0, method: 'Citizens UK West London news archive filtered for explicit Ealing-area relevance.' },
      filteredCivicVideo: { included: videos.items?.length || 0, method: 'Official YouTube Atom feeds filtered to retain explicit local/civic material and suppress routine high-frequency worship/video output.' },
      faithCommunity: { included: faith.items?.length || 0, method: 'First-party faith/community and education pages monitored only for civic, interfaith, outreach or explicitly local public-interest material.' }
    }
  }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
