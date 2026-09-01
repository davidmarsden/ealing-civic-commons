import localFeedHandler from './feed.mjs';
import { fetchGlaFeed } from './gla-feed.mjs';
import { fetchCommunityPageFeed } from './community-page-feed.mjs';
import { fetchLivingPageFeed } from './living-page-feed.mjs';
import { fetchMetEalingFeed } from './met-ealing-feed.mjs';
import { fetchEalingCitizensFeed } from './ealing-citizens-feed.mjs';
import { fetchFilteredVideoFeed } from './filtered-video-feed.mjs';
import { fetchFaithCommunityFeed } from './faith-community-feed.mjs';
import { listPublishedContributions } from '../lib/public-contributions.mjs';
import { getArchivedItem, stableItemKey } from '../lib/civic-items.mjs';

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

async function reviewedContextActivity() {
  try {
    const published = await listPublishedContributions({ limit: 24 });
    const recent = published.slice(-12);
    const activities = await Promise.all(recent.map(async contribution => {
      const key = stableItemKey(contribution.itemId);
      const archived = await getArchivedItem(key, { consistency: 'strong' }).catch(() => null);
      if (!archived?.item) return null;
      const parent = archived.item;
      return {
        // This is activity *on* the stable parent civic object, not a new civic
        // object. Keeping the parent identity makes every normal timeline link,
        // follow and contribution-thread lookup land on the existing item page.
        id: parent.id,
        sourceId: 'civic-commons-context',
        source: 'Civic Commons',
        sourceClass: 'Reviewed civic context',
        sourceHomepage: '/',
        title: `New local context — ${parent.title}`,
        url: parent.url || `/items/${key}`,
        canonicalUrl: parent.canonicalUrl || parent.url || null,
        summary: contribution.body,
        publishedAt: contribution.publishedAt || contribution.submittedAt || null,
        originalPublishedAt: parent.publishedAt || null,
        originalSource: parent.source || null,
        towns: Array.isArray(parent.towns) ? parent.towns : [],
        topics: Array.isArray(parent.topics) ? parent.topics : [],
        derived: true,
        derivedFrom: 'Human-reviewed contribution to an archived Civic Commons item',
        activityType: 'new-context',
        parentItemKey: key,
        parentItemId: parent.id,
        contributionId: contribution.id
      };
    }));
    return activities.filter(Boolean);
  } catch (error) {
    console.error('Reviewed civic context activity unavailable', error);
    return [];
  }
}

export default async request => {
  const [localResponse, gla, community, living, met, citizens, videos, faith, contextActivity] = await Promise.all([
    localFeedHandler(request),
    fetchGlaFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'gla-filtered', name: 'London City Hall / Assembly', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchCommunityPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'community-page-watch', name: 'Community page watch', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchLivingPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'living-page-watch', name: 'Living publication pages', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchMetEalingFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'met-ealing', name: 'Metropolitan Police — Ealing', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchEalingCitizensFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'ealing-citizens', name: 'Ealing Citizens / Citizens UK', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchFilteredVideoFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'filtered-video', name: 'Filtered civic video sources', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchFaithCommunityFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'faith-community', name: 'Faith and community sources', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    reviewedContextActivity()
  ]);

  const local = localResponse?.ok ? await localResponse.json() : { items: [], health: [], enrichment: {} };
  const items = dedupe([...(contextActivity || []), ...(local.items || []), ...(gla.items || []), ...(community.items || []), ...(living.items || []), ...(met.items || []), ...(citizens.items || []), ...(videos.items || []), ...(faith.items || [])])
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 220);

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    items,
    health: [...(local.health || []), ...(gla.health || []), ...(community.health || []), ...(living.health || []), ...(met.health || []), ...(citizens.health || []), ...(videos.health || []), ...(faith.health || [])],
    enrichment: {
      ...(local.enrichment || {}),
      reviewedCivicContext: { included: contextActivity.length, method: 'Human-approved contributions resurface their stable archived civic item as new Commons activity without changing the original publisher or publication date.' },
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
