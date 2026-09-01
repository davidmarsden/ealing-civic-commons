import { listArchivedItems } from '../lib/civic-items.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, stale-while-revalidate=300'
  }
});

export default async request => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(request.url);
  try {
    const result = await listArchivedItems({
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
      sourceId: url.searchParams.get('source'),
      town: url.searchParams.get('town'),
      topic: url.searchParams.get('topic'),
      q: url.searchParams.get('q')
    });
    return json({ version: 1, ...result });
  } catch (error) {
    console.error('Civic Archive lookup failed', error);
    return json({ error: 'The Civic Archive is temporarily unavailable.' }, 503);
  }
};
