import feedHandler from './feed.mjs';
import { archiveItems } from '../lib/civic-items.mjs';

export default async request => {
  try {
    const response = await feedHandler(request);
    if (!response?.ok) {
      console.error(`Civic item archive skipped: feed returned HTTP ${response?.status || 'unknown'}`);
      return;
    }

    const data = await response.json();
    const result = await archiveItems(data.items || []);
    console.log(`Civic item archive complete: ${result.stored} stored; ${result.newCandidates} candidates; ${result.failed} failed; manifest ${result.manifestSize}`);
  } catch (error) {
    console.error('Civic item archive failed', error);
  }
};

export const config = {
  schedule: '*/15 * * * *'
};
