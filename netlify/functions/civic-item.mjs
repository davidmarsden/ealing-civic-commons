import feedHandler from './combined-feed.mjs';
import { getArchivedItem, stableItemKey, validItemKey } from '../lib/civic-items.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status === 200 ? 'public, max-age=300, stale-while-revalidate=900' : 'no-store',
    'access-control-allow-origin': '*'
  }
});

async function findLiveItem(request, key) {
  try {
    const response = await feedHandler(request);
    if (!response?.ok) return null;
    const data = await response.json();
    return (data.items || []).find(item => stableItemKey(item.id) === key) || null;
  } catch (error) {
    console.error(`Live civic item fallback failed for ${key}`, error);
    return null;
  }
}

export default async request => {
  const url = new URL(request.url);
  const key = String(url.searchParams.get('key') || '').trim();
  if (!validItemKey(key)) return json({ error: 'Invalid civic item key.' }, 400);

  try {
    const record = await getArchivedItem(key);
    if (record) return json({ item: record.item, archivedAt: record.archivedAt, key: record.key });

    // Fresh live items can exist before the next scheduled archive run. Deploy
    // previews never run scheduled functions, so resolving from the current
    // combined feed also keeps preview permalinks usable without pretending the
    // item has already entered persistent civic memory.
    const liveItem = await findLiveItem(request, key);
    if (liveItem) return json({ item: liveItem, archivedAt: null, key, liveFallback: true });

    return json({ error: 'Civic item not found.' }, 404);
  } catch (error) {
    console.error(`Persistent civic item lookup failed for ${key}`, error);
    const liveItem = await findLiveItem(request, key);
    if (liveItem) return json({ item: liveItem, archivedAt: null, key, liveFallback: true });
    return json({ error: 'Persistent civic item store is temporarily unavailable.' }, 503);
  }
};
