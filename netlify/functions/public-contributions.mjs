import { listPublishedContributions } from '../lib/public-contributions.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=30, stale-while-revalidate=120'
  }
});

export default async request => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(request.url);
  const threadId = String(url.searchParams.get('thread') || '').trim() || null;
  try {
    const contributions = await listPublishedContributions({ threadId, limit: threadId ? 250 : 1000 });
    return json({ version: 1, updatedAt: new Date().toISOString(), contributions });
  } catch (error) {
    console.error('Published contributions lookup failed', error);
    return json({ error: 'Published contributions are temporarily unavailable.' }, 503);
  }
};
