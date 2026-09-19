const CHAT_ORIGIN = 'https://chat-dev.ealing.civiccommons.co.uk';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': status === 200 ? 'public, max-age=30, stale-while-revalidate=90' : 'no-store',
    'access-control-allow-origin': '*'
  }
});

export default async request => {
  const requestUrl = new URL(request.url);
  const objectUrl = String(requestUrl.searchParams.get('url') || '').trim();

  let parsed;
  try {
    parsed = new URL(objectUrl);
  } catch {
    return json({ error: 'Invalid civic object URL.' }, 400);
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'ealing.civiccommons.co.uk' || !parsed.pathname.startsWith('/items/')) {
    return json({ error: 'Only canonical Ealing Civic Commons item URLs can be queried.' }, 400);
  }

  try {
    const chatUrl = new URL('/getcommonsdiscussions', CHAT_ORIGIN);
    chatUrl.searchParams.set('url', parsed.href);
    const response = await fetch(chatUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.warn('Commons Chat discussion lookup returned', response.status);
      return json({ available: false, threads: [], postCount: 0, conversationCount: 0 }, 200);
    }

    const data = await response.json();
    return json({
      available: true,
      objectUrl: parsed.href,
      conversationCount: Number(data.conversationCount || data.threads?.length || 0),
      postCount: Number(data.postCount || 0),
      threads: Array.isArray(data.threads) ? data.threads.slice(0, 8) : []
    });
  } catch (error) {
    console.warn('Commons Chat discussion lookup failed', error);
    return json({ available: false, threads: [], postCount: 0, conversationCount: 0 }, 200);
  }
};
