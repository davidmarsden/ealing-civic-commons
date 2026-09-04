import feedHandler from './combined-feed.mjs';
import { fetchEalingCouncilDocuments } from './ealing-council-documents.mjs';
import { fetchRichSourceFeed } from './rich-source-feed.mjs';
import { fetchStopTowersFeed } from './stop-towers-feed.mjs';
import { fetchVictoriaHallChronology } from './victoria-hall-chronology.mjs';
import { fetchSouthallExtraSources } from './southall-extra-sources.mjs';
import { archiveItems } from '../lib/civic-items.mjs';

export default async request => {
  try {
    const [response, documents, rich, stopTowers, victoriaHall, southallExtras] = await Promise.all([
      feedHandler(request),
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
      })
    ]);

    if (!response?.ok) {
      console.error(`Civic item archive skipped: feed returned HTTP ${response?.status || 'unknown'}`);
      return;
    }

    const data = await response.json();
    const combined = [...(data.items || []), ...(documents.items || []), ...(rich.archiveItems || []), ...(stopTowers.archiveItems || []), ...(victoriaHall.archiveItems || []), ...(southallExtras.archiveItems || [])];
    const seen = new Set();
    const items = combined.filter(item => {
      if (item?.activityType === 'new-context') return false;
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    const result = await archiveItems(items);
    const campaignCandidates = (stopTowers.archiveItems?.length || 0) + (victoriaHall.archiveItems?.length || 0);
    console.log(`Civic item archive complete: ${result.stored} stored; ${result.newCandidates} candidates; ${result.failed} failed; manifest ${result.manifestSize}; rich-source candidates ${rich.archiveItems?.length || 0}; campaign candidates ${campaignCandidates}; additional Southall candidates ${southallExtras.archiveItems?.length || 0}`);
  } catch (error) {
    console.error('Civic item archive failed', error);
  }
};

export const config = {
  schedule: '*/15 * * * *'
};
