import http from 'node:http';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8788);
const FEEDS = {
  rss: 'https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0',
  petitions: 'https://ealing.moderngov.co.uk/mgRss.aspx?f=2'
};
const CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_TTL_MS = 30 * 60 * 1000;

const caches = new Map(Object.keys(FEEDS).map(key => [key, {
  body: null,
  contentType: 'application/rss+xml; charset=utf-8',
  fetchedAt: 0,
  upstreamStatus: null,
  error: null
}]));

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

async function fetchUpstream(key) {
  const upstream = FEEDS[key];
  let cache = caches.get(key);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const startedAt = Date.now();

  try {
    const response = await fetch(upstream, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Ealing-Civic-Commons-ModernGov-Relay/1.1 (+https://ealing.civiccommons.co.uk/)'
      }
    });

    const body = await response.text();
    cache.upstreamStatus = response.status;

    if (!response.ok) throw new Error(`ModernGov returned HTTP ${response.status}`);
    if (!/<(?:rss|feed)\b/i.test(body)) throw new Error('ModernGov response did not look like RSS/Atom XML');

    cache = {
      body,
      contentType: response.headers.get('content-type') || 'application/rss+xml; charset=utf-8',
      fetchedAt: Date.now(),
      upstreamStatus: response.status,
      error: null,
      elapsedMs: Date.now() - startedAt
    };
    caches.set(key, cache);
    return { ...cache, cacheState: 'miss' };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'ModernGov request timed out' : String(error?.message || error);
    cache.error = message;
    caches.set(key, cache);
    if (cache.body && Date.now() - cache.fetchedAt <= STALE_TTL_MS) return { ...cache, cacheState: 'stale', error: message };
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }
}

async function getFeed(key) {
  const cache = caches.get(key);
  if (cache.body && Date.now() - cache.fetchedAt <= CACHE_TTL_MS) return { ...cache, cacheState: 'hit' };
  return fetchUpstream(key);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    return res.end();
  }

  if (url.pathname === '/health') {
    const feeds = Object.fromEntries(Object.entries(FEEDS).map(([key, upstream]) => {
      const cache = caches.get(key);
      return [key, {
        upstream,
        cached: Boolean(cache.body),
        fetchedAt: cache.fetchedAt ? new Date(cache.fetchedAt).toISOString() : null,
        ageSeconds: cache.fetchedAt ? Math.floor((Date.now() - cache.fetchedAt) / 1000) : null,
        upstreamStatus: cache.upstreamStatus,
        lastError: cache.error
      }];
    }));
    return json(res, 200, { ok: true, service: 'ealing-moderngov-relay', feeds });
  }

  const key = url.pathname === '/rss' ? 'rss' : url.pathname === '/petitions' ? 'petitions' : null;
  if (!key) return json(res, 404, { ok: false, error: 'Not found' });

  try {
    const result = await getFeed(key);
    res.writeHead(200, {
      'content-type': result.contentType,
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
      'x-civic-commons-relay-cache': result.cacheState,
      'x-content-type-options': 'nosniff'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(result.body);
  } catch (error) {
    json(res, 502, { ok: false, error: String(error?.message || error), upstream: FEEDS[key] });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ModernGov relay listening on http://${HOST}:${PORT}`);
});
