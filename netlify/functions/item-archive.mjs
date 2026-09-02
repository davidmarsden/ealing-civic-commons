import feedHandler from './combined-feed.mjs';
import { fetchEalingCouncilDocuments } from './ealing-council-documents.mjs';
import { fetchRichSourceFeed } from './rich-source-feed.mjs';
import { archiveItems } from '../lib/civic-items.mjs';

export default async request => {
  try {
    const [response, documents, rich] = await Promise.all([
      feedHandler(request),
      fetchEalingCouncilDocuments().catch(error => {
        console.error('Document Watch archive enrichment failed', error);
        return { items: [] };
      }),
      fetchRichSourceFeed().catch(error => {
        console.error('Rich source archive enrichment failed', error);
        return { archiveItems: [] };
      })
    ]);

    if (!response?.ok) {
      console.error(`Civic item archive skipped: feed returned HTTP ${response?.status || 'unknown'}`);
      return;
    }

    const data = await response.json();
    const combined = [...(data.items || []), ...(documents.items || []), ...(rich.archiveItems || [])];
    const seen = new Set();
    const items = combined.filter(item => {
      if (item?.activityType === 'new-context') return false;
      if (!item?.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    const result = await archiveItems(items);
    console.log(`Civic item archive complete: ${result.stored} stored; ${result.newCandidates} candidates; ${result.failed} failed; manifest ${result.manifestSize}; rich-source candidates ${rich.archiveItems?.length || 0}`);
  } catch (error) {
    console.error('Civic item archive failed', error);
  }
};

export const config = {
  schedule: '*/15 * * * *'
};
