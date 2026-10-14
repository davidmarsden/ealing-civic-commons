#!/usr/bin/env node
// Page-load measurement for Phase 4: loads pages in Chromium with a mid-range
// phone profile (throttled network and CPU): cold, as a repeat visit, and a third
// time (steady state, once the service worker has cached what the second visit
// fetched). Reports requests, bytes, cache use and LCP.
//
//   npm i --no-save playwright && BASE_URL=https://ealing.civiccommons.co.uk \
//     node scripts/measure-pages.mjs [/ /places/southall-gasworks …]
//
// Set CHROMIUM_PATH to use a pre-installed browser; HTTPS_PROXY is honoured.
//
// "Round trips" counts same-origin requests that reached the network, including
// conditional revalidations answered 304 (which resource timing reports as cache
// hits) and every request the service worker forwards. Requests answered from the
// service worker's cache or a fresh HTTP cache entry are not round trips.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { chromium } = await import('playwright');

const base = String(process.env.BASE_URL || 'https://ealing.civiccommons.co.uk').replace(/\/$/, '');
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/places/southall-gasworks', '/issues/southall-gasworks', '/explore.html'];
const runs = Number(process.env.RUNS || 3);
// Roughly Lighthouse's mobile profile: 1.6 Mbps down, 750 kbps up, 150 ms RTT, 4x CPU.
const NETWORK = { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 };

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, proxy, args: ['--disable-dev-shm-usage'] });

async function load(page, cdp, url) {
  const started = Date.now();
  const { origin } = new URL(url);
  const network = [];
  // Page requests: CDP says whether the service worker or a cache answered them.
  const cached = new Set();
  const onCdp = ({ requestId, response }) => { if (response.fromServiceWorker || response.fromDiskCache || response.fromPrefetchCache) cached.add(requestId); };
  const onServed = ({ requestId }) => cached.add(requestId);
  const pageRequests = new Map();
  const onPageResponse = ({ requestId, response }) => { if (response.url.startsWith(origin)) pageRequests.set(requestId, new URL(response.url).pathname); };
  cdp.on('Network.responseReceived', onCdp);
  cdp.on('Network.responseReceived', onPageResponse);
  cdp.on('Network.requestServedFromCache', onServed);
  // Requests the service worker itself makes reach the network (or revalidate).
  const onWorker = request => { if (request.serviceWorker() && request.url().startsWith(origin)) network.push(new URL(request.url()).pathname); };
  page.context().on('requestfinished', onWorker);
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(1500);
  page.context().off('requestfinished', onWorker);
  cdp.off('Network.responseReceived', onCdp);
  cdp.off('Network.responseReceived', onPageResponse);
  cdp.off('Network.requestServedFromCache', onServed);
  for (const [requestId, pathname] of pageRequests) if (!cached.has(requestId)) network.push(pathname);
  // A page whose main thread never yields would hang evaluate(); report it instead.
  const timing = await Promise.race([new Promise(resolve => setTimeout(() => resolve({ frozen: true }), 20000)), page.evaluate(started => new Promise(resolve => {
    let lcp = null;
    new PerformanceObserver(list => { const entries = list.getEntries(); lcp = entries[entries.length - 1]?.startTime ?? lcp; }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const sameOrigin = resources.filter(r => r.name.startsWith(location.origin));
      const byType = {};
      for (const r of sameOrigin) {
        const type = r.initiatorType === 'link' && /\.css(\?|$)/.test(r.name) ? 'css' : r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name) ? 'script' : r.initiatorType === 'fetch' ? 'fetch' : r.initiatorType;
        byType[type] = byType[type] || { requests: 0, network: 0, bytes: 0 };
        byType[type].requests += 1;
        if (r.transferSize > 0) { byType[type].network += 1; byType[type].bytes += r.transferSize; }
      }
      resolve({
        lcpMs: lcp == null ? null : Math.round(lcp),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        documentBytes: nav.transferSize,
        sameOriginRequests: sameOrigin.length,
        sameOriginNetworkRequests: sameOrigin.filter(r => r.transferSize > 0).length,
        sameOriginBytes: sameOrigin.reduce((total, r) => total + r.transferSize, 0),
        byType
      });
    }, 300);
  }), started)]);
  if (timing.frozen) return { frozen: true, roundTrips: network.length };
  return { ...timing, roundTrips: network.filter(path => !path.startsWith('/.netlify/')).length, functionCalls: network.filter(path => path.startsWith('/.netlify/')).length };
}

const median = values => { const sorted = values.filter(v => v != null).sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null; };
const report = { base, profile: { ...NETWORK, cpuSlowdown: 4 }, runs, pages: {} };
for (const path of paths) {
  const cold = [], warm = [], steady = [];
  for (let i = 0; i < runs; i += 1) {
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', NETWORK);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const url = `${base}${path}`;
    cold.push(await load(page, cdp, url));
    // A frozen page cannot be navigated reliably; skip its repeat visit.
    if (!cold.at(-1).frozen) {
      warm.push(await load(page, cdp, url));
      // Third visit: the service worker has now cached what the second visit fetched.
      if (!warm.at(-1).frozen) steady.push(await load(page, cdp, url));
    }
    await context.close();
  }
  const summarise = set => set.some(r => r.frozen) ? { frozen: set.filter(r => r.frozen).length } : ({
    lcpMs: median(set.map(r => r.lcpMs)),
    loadMs: median(set.map(r => r.loadMs)),
    sameOriginRequests: median(set.map(r => r.sameOriginRequests)),
    networkRequests: median(set.map(r => r.sameOriginNetworkRequests)),
    roundTrips: median(set.map(r => r.roundTrips)),
    functionCalls: median(set.map(r => r.functionCalls)),
    kb: Math.round(median(set.map(r => r.sameOriginBytes)) / 1024),
    scripts: set[0].byType.script, css: set[0].byType.css
  });
  report.pages[path] = { cold: summarise(cold), repeat: warm.length ? summarise(warm) : null, steady: steady.length ? summarise(steady) : null };
  console.log(path, JSON.stringify(report.pages[path]));
}
await browser.close();
if (process.env.REPORT_FILE) (await import('node:fs/promises')).writeFile(process.env.REPORT_FILE, JSON.stringify(report, null, 2));
