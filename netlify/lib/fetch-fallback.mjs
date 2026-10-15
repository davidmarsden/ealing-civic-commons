// Third-party retrieval fallback for feed sources. Some publishers' hosts (often
// Cloudflare bot protection) refuse requests from cloud servers such as Netlify's,
// whatever the user-agent, while the site works in a browser. During the ingest,
// a source request that is refused this way is retried once through Apify's
// web-fetch actor, which fetches the page from its own network and returns the
// original body. Every use is recorded so the source's health can say how it was
// retrieved; nothing is presented as a direct fetch.
//
// Active only when APIFY_TOKEN is set, only for GET requests to other sites, and
// only up to a per-run budget, so a broken source cannot run up costs.
const ACTOR_URL = 'https://api.apify.com/v2/acts/apify~web-fetch/run-sync-get-dataset-items';
const RETRY_STATUSES = new Set([403, 429, 503, 520, 521, 522, 523, 524, 525, 526, 530]);
const DEFAULT_BUDGET = 40;
const TIMEOUT_MS = 45000;

const hostOf = value => { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return null; } };

function shouldRetry(response, error) {
  if (error) {
    // The adapter's own timeout (AbortError) is a deliberate budget; a refused or
    // reset connection is worth one retry from another network.
    if (error?.name === 'AbortError') return false;
    return /fetch failed|ECONNRESET|ECONNREFUSED|socket|TLS|certificate/i.test(String(error?.message || error) + String(error?.cause?.code || ''));
  }
  return RETRY_STATUSES.has(response.status);
}

async function fetchViaActor(originalFetch, url, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await originalFetch(`${ACTOR_URL}?token=${encodeURIComponent(token)}&timeout=40`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, formats: ['raw'] })
    });
    if (!response.ok) throw new Error(`fallback fetcher HTTP ${response.status}`);
    const [item] = await response.json();
    const status = Number(item?.fetch?.httpStatusCode) || 0;
    if (!item || typeof item.raw !== 'string' || !status) throw new Error('fallback fetcher returned no page');
    return new Response(item.raw, {
      status,
      headers: { 'content-type': item.fetch?.contentType || 'text/html; charset=utf-8', 'x-retrieved-via': 'apify-web-fetch' }
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Wraps globalThis.fetch for the duration of an ingest run. Returns { log, restore }.
export function installFetchFallback({ token = process.env.APIFY_TOKEN, budget = Number(process.env.FETCH_FALLBACK_BUDGET) || DEFAULT_BUDGET, ownHosts = [] } = {}) {
  const log = [];
  if (!token) return { log, restore: () => {}, active: false };
  const originalFetch = globalThis.fetch;
  const skipHosts = new Set(['api.apify.com', ...ownHosts.map(hostOf).filter(Boolean)]);
  let used = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    const host = hostOf(url);
    if (method !== 'GET' || !host || skipHosts.has(host) || !/^https?:/i.test(url)) return originalFetch(input, init);

    let response, error;
    try { response = await originalFetch(input, init); } catch (caught) { error = caught; }
    if (!shouldRetry(response, error)) { if (error) throw error; return response; }
    if (used >= budget) {
      log.push({ url, host, direct: error ? String(error?.message || error) : response.status, outcome: 'budget-exhausted' });
      if (error) throw error;
      return response;
    }
    used += 1;
    const started = Date.now();
    try {
      const fallback = await fetchViaActor(originalFetch, url, token);
      log.push({ url, host, direct: error ? String(error?.message || error) : response.status, outcome: 'retrieved', status: fallback.status, ms: Date.now() - started });
      return fallback;
    } catch (fallbackError) {
      log.push({ url, host, direct: error ? String(error?.message || error) : response.status, outcome: 'failed', error: String(fallbackError?.message || fallbackError), ms: Date.now() - started });
      if (error) throw error;
      return response;
    }
  };
  return { log, active: true, restore: () => { globalThis.fetch = originalFetch; } };
}

// Marks health entries whose pages were retrieved through the fallback, matched
// by host, so the site shows how each source was read.
export function annotateRetrieval(health, log) {
  const retrieved = new Map();
  for (const entry of log) if (entry.outcome === 'retrieved') retrieved.set(entry.host, (retrieved.get(entry.host) || 0) + 1);
  if (!retrieved.size) return health;
  return health.map(entry => {
    const count = retrieved.get(hostOf(entry.homepage || entry.url || ''));
    return count ? { ...entry, retrievedVia: 'third-party fetcher', fallbackRequests: count } : entry;
  });
}
