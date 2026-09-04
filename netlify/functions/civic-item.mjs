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
    console.error(`Live civic item lookup failed for ${key}`, error);
    return null;
  }
}

export default async request => {
  const url = new URL(request.url);
  const key = String(url.searchParams.get('key') || '').trim();
  if (!validItemKey(key)) return json({ error: 'Invalid civic item key.' }, 400);

  try {
    // Prefer the current normalised version while an item remains in the live
    // feed. This lets parser corrections and upstream metadata improvements be
    // reflected immediately without changing the stable item key or detaching
    // contributed context. Once an item falls out of the live window, its
    // persistent archived snapshot remains the fallback civic-memory record.
    const liveItem = await findLiveItem(request, key);
    if (liveItem) {
      const archived = await getArchivedItem(key).catch(() => null);
      return json({
        item: liveItem,
        archivedAt: archived?.archivedAt || null,
        key,
        liveCurrent: true
      });
    }

    const record = await getArchivedItem(key);
    if (record) return json({ item: record.item, archivedAt: record.archivedAt, key: record.key });

    return json({ error: 'Civic item not found.' }, 404);
  } catch (error) {
    console.error(`Persistent civic item lookup failed for ${key}`, error);
    const liveItem = await findLiveItem(request, key);
    if (liveItem) return json({ item: liveItem, archivedAt: null, key, liveFallback: true });
    return json({ error: 'Persistent civic item store is temporarily unavailable.' }, 503);
  }
};
