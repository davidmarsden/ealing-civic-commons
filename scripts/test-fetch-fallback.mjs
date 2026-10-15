#!/usr/bin/env node
// Third-party retrieval fallback: when it retries, what it returns, its budget,
// and that failures stay failures.
import assert from 'node:assert/strict';
import { annotateRetrieval, installFetchFallback } from '../netlify/lib/fetch-fallback.mjs';

const calls = [];
let actorReply = url => [{ raw: `<html>${url}</html>`, fetch: { httpStatusCode: 200, contentType: 'text/html; charset=utf-8' } }];
const sites = {
  'https://blocked.example/news/': () => new Response('denied', { status: 403 }),
  'https://ok.example/': () => new Response('fine', { status: 200 }),
  'https://missing.example/': () => new Response('gone', { status: 404 }),
  'https://reset.example/': () => { throw new TypeError('fetch failed'); },
  'https://slow.example/': () => { const error = new Error('aborted'); error.name = 'AbortError'; throw error; },
  'https://commons.example/.netlify/functions/feed': () => new Response('own', { status: 403 })
};
const base = async (input, init = {}) => {
  const url = String(typeof input === 'string' ? input : input.url);
  calls.push({ url, method: init.method || 'GET' });
  if (url.startsWith('https://api.apify.com/')) {
    const { url: target } = JSON.parse(init.body);
    const reply = actorReply(target);
    return reply instanceof Response ? reply : new Response(JSON.stringify(reply), { status: 201 });
  }
  return sites[url]();
};
globalThis.fetch = base;

// Without a token nothing changes.
const off = installFetchFallback({ token: '' });
assert.equal(off.active, false);
assert.equal((await fetch('https://blocked.example/news/')).status, 403);
off.restore();

const run = installFetchFallback({ token: 'test-token', budget: 2, ownHosts: ['https://commons.example'] });
// A refused page is fetched through the fallback and labelled as such.
const page = await fetch('https://blocked.example/news/', { headers: { 'user-agent': 'x' } });
assert.equal(page.status, 200);
assert.equal(await page.text(), '<html>https://blocked.example/news/</html>');
assert.equal(page.headers.get('x-retrieved-via'), 'apify-web-fetch');
const actorCall = calls.find(call => call.url.startsWith('https://api.apify.com/'));
assert.ok(actorCall && actorCall.method === 'POST' && actorCall.url.includes('token=test-token'));
// Successes, real 404s, own-site requests, non-GET requests and the adapter's own timeouts are left alone.
assert.equal((await fetch('https://ok.example/')).status, 200);
assert.equal((await fetch('https://missing.example/')).status, 404);
assert.equal((await fetch('https://commons.example/.netlify/functions/feed')).status, 403);
assert.equal((await fetch('https://blocked.example/news/', { method: 'POST', body: 'x' })).status, 403);
await assert.rejects(fetch('https://slow.example/'), /aborted/);
// A refused connection is retried too.
assert.equal((await fetch('https://reset.example/')).status, 200);
// The budget caps fallback use per run; beyond it the original result stands.
assert.equal((await fetch('https://blocked.example/news/')).status, 403);
assert.deepEqual(run.log.map(entry => entry.outcome), ['retrieved', 'retrieved', 'budget-exhausted']);
run.restore();
assert.equal(globalThis.fetch, base, 'restore puts the original fetch back');

// A failed fallback returns the original response, not a fabricated page.
const failing = installFetchFallback({ token: 't' });
actorReply = () => new Response('quota', { status: 402 });
assert.equal((await fetch('https://blocked.example/news/')).status, 403);
actorReply = () => [{ raw: null, fetch: { httpStatusCode: 0 } }];
assert.equal((await fetch('https://blocked.example/news/')).status, 403);
await assert.rejects(fetch('https://reset.example/'), /fetch failed/);
assert.deepEqual(failing.log.map(entry => entry.outcome), ['failed', 'failed', 'failed']);
failing.restore();

// Health entries are marked by host.
const health = annotateRetrieval([{ id: 'a', homepage: 'https://www.blocked.example/' }, { id: 'b', homepage: 'https://ok.example/' }], run.log);
assert.equal(health[0].retrievedVia, 'third-party fetcher');
assert.equal(health[0].fallbackRequests, 1);
assert.equal(health[1].retrievedVia, undefined);

console.log('Fetch fallback: retry rules, labelled responses, budget, failures and health annotation OK.');
