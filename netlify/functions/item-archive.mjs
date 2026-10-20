import { fetchEalingCouncilDocuments } from './ealing-council-documents.mjs';
import { fetchRichSourceFeed } from './rich-source-feed.mjs';
import { fetchStopTowersFeed } from './stop-towers-feed.mjs';
import { fetchVictoriaHallChronology } from './victoria-hall-chronology.mjs';
import { fetchSouthallExtraSources } from './southall-extra-sources.mjs';
import { fetchBoroughTownSources } from './borough-town-sources.mjs';
import { archiveItems } from '../lib/civic-items.mjs';

// Archives the live feed's items plus the deep/archive-only fetches. Called by
// the background ingest with the feed it has just built, so the upstream fan-out
// runs once per cycle instead of once for the snapshot and again for the archive.
export async function runArchive(data) {
  try {
    const [documents, rich, stopTowers, victoriaHall, southallExtras, boroughTown] = await Promise.all([
      fetchEalingCouncilDocuments().catch(error => {
        console.error('Document Watch archive enrichment failed', error);
        return { items: [] };
      }),
      fetchRichSourceFeed({ deep: true }).catch(error => {
        console.error('Rich source archive enrichment failed', error);
        return { archiveItems: [] };
      }),
      fetchStopTowersFeed({ deep: true }).catch(error => {
        console.error('Stop The Towers archive enrichment failed', error);
        return { archiveItems: [] };
      }),
      fetchVictoriaHallChronology({ deep: true }).catch(error => {
        console.error('Victoria Hall chronology archive enrichment failed', error);
        return { archiveItems: [] };
      }),
      fetchSouthallExtraSources({ deep: true }).catch(error => {
        console.error('Additional Southall source archive enrichment failed', error);
        return { archiveItems: [] };
      }),
      fetchBoroughTownSources().catch(error => {
        console.error('Borough/town source archive enrichment failed', error);
        return { archiveItems: [] };
      })
    ]);

    const combined = [
      ...(data.items || []),
      ...(documents.items || []),
      ...(rich.archiveItems || []),
      ...(stopTowers.archiveItems || []),
      ...(victoriaHall.archiveItems || []),
      ...(southallExtras.archiveItems || []),
      ...(boroughTown.archiveItems || [])
    ];
    const seen = new Set();
    const items = combined.filter(item => {
      if (item?.activityType === 'new-context') return false;
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    const result = await archiveItems(items);
    const campaignCandidates = (stopTowers.archiveItems?.length || 0) + (victoriaHall.archiveItems?.length || 0);
    console.log(`Civic item archive complete: ${result.stored} stored; ${result.newCandidates} candidates; ${result.failed} failed; manifest ${result.manifestSize}; search index ${result.searchIndexSize} (complete: ${result.searchIndexComplete}, backfilled ${result.indexBackfilled}, written: ${result.searchIndexWritten}, bytes: ${result.searchIndexBytes ?? 'unchanged'}); archive timings ${JSON.stringify(result.timings)}; rich-source candidates ${rich.archiveItems?.length || 0}; campaign candidates ${campaignCandidates}; additional Southall candidates ${southallExtras.archiveItems?.length || 0}; borough/town candidates ${boroughTown.archiveItems?.length || 0}`);
    return result;
  } catch (error) {
    console.error('Civic item archive failed', error);
    return { error: String(error?.message || error) };
  }
};

// The scheduled entry point only starts the background ingest and returns, well
// inside the scheduled-function limit. Running the whole ingest here used to take
// 15-25 s, so the scheduler timed out and retried each slot two or three times.
export default async (request, context) => {
  const origin = context?.site?.url || process.env.URL;
  try {
    const response = await fetch(new URL('/.netlify/functions/feed-ingest', origin), { method: 'POST', headers: { 'x-ingest-trigger': 'schedule' } });
    console.log(`Feed ingest triggered: HTTP ${response.status}`);
  } catch (error) {
    console.error('Feed ingest trigger failed', error);
  }
};

export const config = {
  schedule: '*/15 * * * *'
};