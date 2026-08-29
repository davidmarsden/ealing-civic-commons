import { getArchivedItem, validItemKey } from '../lib/civic-items.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status === 200 ? 'public, max-age=300, stale-while-revalidate=900' : 'no-store',
    'access-control-allow-origin': '*'
  }
});

export default async request => {
  const url = new URL(request.url);
  const key = String(url.searchParams.get('key') || '').trim();
  if (!validItemKey(key)) return json({ error: 'Invalid civic item key.' }, 400);

  try {
    const record = await getArchivedItem(key);
    if (!record) return json({ error: 'Civic item not found.' }, 404);
    return json({ item: record.item, archivedAt: record.archivedAt, key: record.key });
  } catch (error) {
    console.error(`Persistent civic item lookup failed for ${key}`, error);
    return json({ error: 'Persistent civic item store is temporarily unavailable.' }, 503);
  }
};
