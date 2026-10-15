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
// The fallback has its own time limit rather than the adapter's: adapter timeouts
// (7.5-18 s) budget a direct fetch and are often mostly spent by the time a 403
// arrives. Fallback fetches usually take about 6 s but escalate to slower routes
// for some sites (35 s measured for ealingindependents.org on 15 Oct). 60 s bounds
// how long one source can hold the background ingest (15-minute limit); sources
// run in parallel.
const TIMEOUT_MS = 60000;

const hostOf = value => { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return null; } };
// The site a host belongs to: news.met.police.uk and www.met.police.uk are both
// met.police.uk. UK second-level suffixes (co.uk, police.uk, …) are kept whole.
const UK_SECOND_LEVEL = new Set(['co', 'org', 'gov', 'ac', 'police', 'nhs', 'ltd', 'me', 'net', 'sch', 'plc']);
export function siteOf(host) {
  const labels = String(host || '').toLowerCase().split('.').filter(Boolean);
  const keep = labels.length >= 2 && labels.at(-1) === 'uk' && UK_SECOND_LEVEL.has(labels.at(-2)) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

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
    const response = await originalFetch(`${ACTOR_URL}?token=${encodeURIComponent(token)}&timeout=55`, {
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
  // One fallback attempt per URL per run: adapters often retry a refused page
  // themselves (e.g. with a browser user-agent), and sources run in parallel, so
  // the same URL could otherwise go to the fallback more than once.
  const attempted = new Map();

  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    const host = hostOf(url);
    if (method !== 'GET' || !host || skipHosts.has(host) || !/^https?:/i.test(url)) return originalFetch(input, init);

    let response, error;
    try { response = await originalFetch(input, init); } catch (caught) { error = caught; }
    if (!shouldRetry(response, error)) { if (error) throw error; return response; }
    // Concurrent and later requests for a URL share its one fallback attempt
    // (a promise of the retrieved page, or null if the fallback failed).
    if (!attempted.has(url)) {
      if (used >= budget) {
        log.push({ url, host, direct: error ? String(error?.message || error) : response.status, outcome: 'budget-exhausted' });
        if (error) throw error;
        return response;
      }
      used += 1;
      const started = Date.now();
      const direct = error ? String(error?.message || error) : response.status;
      attempted.set(url, fetchViaActor(originalFetch, url, token).then(async fallback => {
        const page = { body: await fallback.text(), status: fallback.status, headers: Object.fromEntries(fallback.headers) };
        log.push({ url, host, direct, outcome: 'retrieved', status: page.status, ms: Date.now() - started });
        return page;
      }, fallbackError => {
        log.push({ url, host, direct, outcome: 'failed', error: String(fallbackError?.message || fallbackError), ms: Date.now() - started });
        return null;
      }));
    }
    const page = await attempted.get(url);
    if (page) return new Response(page.body, { status: page.status, headers: page.headers });
    if (error) throw error;
    return response;
  };
  return { log, active: true, restore: () => { globalThis.fetch = originalFetch; } };
}

// Requests that actually went to the fallback fetcher (not those skipped once the
// budget was spent).
export const fallbackAttempts = log => log.filter(entry => entry.outcome === 'retrieved' || entry.outcome === 'failed').length;

// Marks health entries whose pages were retrieved through the fallback, so the
// site shows how each source was read. A retrieval is attributed to an entry when
// the requested URL is the entry's URL or lies under its homepage; failing that,
// by site, but only when exactly one entry uses that site (YouTube, for example,
// serves many sources and must not mark them all).
export function annotateRetrieval(health, log) {
  const retrieved = log.filter(entry => entry.outcome === 'retrieved');
  if (!retrieved.length) return health;
  const strip = value => String(value || '').replace(/^https?:\/\/(www\.)?/i, '').replace(/#.*$/, '').replace(/\/+(\?|$)/, '$1');
  const siteCounts = new Map();
  for (const entry of health) { const site = siteOf(hostOf(entry.homepage || entry.url || '')); if (site) siteCounts.set(site, (siteCounts.get(site) || 0) + 1); }
  return health.map(entry => {
    const own = [entry.url, entry.feedUrl, entry.homepage].filter(Boolean).map(strip);
    const site = siteOf(hostOf(entry.homepage || entry.url || ''));
    const matches = retrieved.filter(item => {
      const target = strip(item.url);
      if (own.some(base => base && (target === base || target.startsWith(`${base}/`)))) return true;
      return site && siteOf(item.host) === site && siteCounts.get(site) === 1;
    });
    return matches.length ? { ...entry, retrievedVia: 'third-party fetcher', fallbackRequests: matches.length } : entry;
  });
}

// Per-host summary of a run's fallback use, recorded with the snapshot.
export function fallbackHosts(log) {
  const hosts = {};
  for (const entry of log) {
    const host = (hosts[entry.host] = hosts[entry.host] || { retrieved: 0, failed: 0, skipped: 0 });
    if (entry.outcome === 'retrieved') host.retrieved += 1;
    else if (entry.outcome === 'failed') host.failed += 1;
    else host.skipped += 1;
  }
  return hosts;
}
