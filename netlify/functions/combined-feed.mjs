import localFeedHandler from './feed.mjs';
import { fetchGlaFeed } from './gla-feed.mjs';
import { fetchCommunityPageFeed } from './community-page-feed.mjs';
import { fetchLivingPageFeed } from './living-page-feed.mjs';
import { fetchRichSourceFeed } from './rich-source-feed.mjs';
import { fetchMetEalingFeed } from './met-ealing-feed.mjs';
import { fetchEalingCitizensFeed } from './ealing-citizens-feed.mjs';
import { fetchFilteredVideoFeed } from './filtered-video-feed.mjs';
import { fetchFaithCommunityFeed } from './faith-community-feed.mjs';
import { fetchModernGovWhatsNew } from './moderngov-whatsnew.mjs';
import { listPublishedContributions } from '../lib/public-contributions.mjs';
import { getArchivedItem, stableItemKey } from '../lib/civic-items.mjs';

const LIVE_LIMIT = 220;
const COVERAGE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

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

function itemKey(item) {
  return canonical(item?.canonicalUrl) || item?.id || null;
}

function publishedTime(item) {
  const value = Date.parse(item?.publishedAt || '');
  return Number.isFinite(value) ? value : 0;
}

function dedupe(items = []) {
  const seen = new Set();
  return items.filter(item => {
    const key = itemKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coveragePreservingSlice(items = [], limit = LIVE_LIMIT) {
  const sorted = [...items].sort((a, b) => publishedTime(b) - publishedTime(a));
  const cutoff = Date.now() - COVERAGE_WINDOW_MS;
  const reservedBySource = new Map();

  // Preserve the newest recent item from each non-official source before the
  // global cap is applied. This prevents high-volume official/document feeds
  // from making quieter journalism and community sources disappear entirely.
  for (const item of sorted) {
    if (!item?.sourceId || item.sourceClass === 'Official record') continue;
    if (publishedTime(item) < cutoff) continue;
    if (!reservedBySource.has(item.sourceId)) reservedBySource.set(item.sourceId, item);
  }

  const selected = new Map();
  for (const item of reservedBySource.values()) {
    const key = itemKey(item);
    if (key) selected.set(key, item);
  }

  for (const item of sorted) {
    if (selected.size >= limit) break;
    const key = itemKey(item);
    if (key && !selected.has(key)) selected.set(key, item);
  }

  return [...selected.values()]
    .sort((a, b) => publishedTime(b) - publishedTime(a))
    .slice(0, limit);
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
  const [localResponse, modernGov, gla, community, living, rich, met, citizens, videos, faith, contextActivity] = await Promise.all([
    localFeedHandler(request),
    fetchModernGovWhatsNew().catch(error => ({ items: [], health: [{ id: 'modern-gov', name: 'Ealing Council — ModernGov', homepage: 'https://ealing.moderngov.co.uk/', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchGlaFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'gla-filtered', name: 'London City Hall / Assembly', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchCommunityPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'community-page-watch', name: 'Community page watch', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchLivingPageFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'living-page-watch', name: 'Living publication pages', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchRichSourceFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], archiveItems: [], health: [{ id: 'rich-source-watch', name: 'Rich civic source sites', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchMetEalingFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'met-ealing', name: 'Metropolitan Police — Ealing', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchEalingCitizensFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'ealing-citizens', name: 'Ealing Citizens / Citizens UK', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchFilteredVideoFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'filtered-video', name: 'Filtered civic video sources', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    fetchFaithCommunityFeed().catch(error => ({ generatedAt: new Date().toISOString(), items: [], health: [{ id: 'faith-community', name: 'Faith and community sources', ok: false, status: 'error', error: String(error?.message || error), itemCount: 0 }] })),
    reviewedContextActivity()
  ]);

  const local = localResponse?.ok ? await localResponse.json() : { items: [], health: [], enrichment: {} };
  // The old ModernGov RSS endpoint remains in the legacy local feed for now,
  // but its blocked health row/items are replaced here by the public What's New adapter.
  const localItems = (local.items || []).filter(item => item.sourceId !== 'modern-gov');
  const localHealth = (local.health || []).filter(entry => entry.id !== 'modern-gov');
  const combined = dedupe([...(contextActivity || []), ...localItems, ...(modernGov.items || []), ...(rich.items || []), ...(gla.items || []), ...(community.items || []), ...(living.items || []), ...(met.items || []), ...(citizens.items || []), ...(videos.items || []), ...(faith.items || [])]);
  const items = coveragePreservingSlice(combined);

  return new Response(JSON.stringify({
    generatedAt: new Date().toISOString(),
    items,
    health: [...localHealth, ...(modernGov.health || []), ...(rich.health || []), ...(gla.health || []), ...(community.health || []), ...(living.health || []), ...(met.health || []), ...(citizens.health || []), ...(videos.health || []), ...(faith.health || [])],
    enrichment: {
      ...(local.enrichment || {}),
      reviewedCivicContext: { included: contextActivity.length, method: 'Human-approved contributions resurface their stable archived civic item as new Commons activity without changing the original publisher or publication date.' },
      modernGovWhatsNew: { included: modernGov.items?.length || 0, method: 'Ealing ModernGov public What’s New listings parsed as an official publication-change stream. Agenda, minutes, decision, issue, plan and petition publications are included; meeting-held-only events are excluded.' },
      liveSourceCoverage: { method: 'Chronological live feed capped at 220 items while reserving the newest item from each non-official source published in the last 90 days, preventing high-volume official feeds from crowding quieter civic sources out entirely.' },
      richSourceSites: { included: rich.items?.length || 0, archiveCandidates: rich.archiveItems?.length || 0, method: 'Dated first-party archive/listing surfaces from evidence-rich civic sites are extracted separately from the live-feed cutoff so their older material can become durable civic memory.' },
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
