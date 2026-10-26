#!/usr/bin/env node
// ModernGov "What's new": a week with only meeting notices is a quiet week
// (no-new-records), not an outage, and the slow fallbacks are not tried.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchModernGovWhatsNew } from '../netlify/functions/moderngov-whatsnew.mjs';
import { sourceStateFor } from '../netlify/lib/feed-snapshot.mjs';

// Captured from the relay on 26 Oct 2026: five "Meeting held" items only.
const meetingsOnly = await readFile('scripts/fixtures/moderngov-meetings-only.xml', 'utf8');
const withAgenda = meetingsOnly.replace('<item>', `<item>
      <title>Agenda published:  Cabinet, Wednesday, 4 November 2026 7.00 pm</title>
      <link>https://Ealing.moderngov.co.uk/ieListDocuments.aspx?MId=7001&amp;EVT=1</link>
      <pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate>
      <description><![CDATA[Cabinet]]></description>
    </item>
    <item>`);

async function run(relayBody, relayType = 'application/rss+xml') {
  const requested = [];
  globalThis.fetch = async input => {
    const url = String(input?.url || input);
    requested.push(url);
    if (url.includes('/_relay/moderngov/rss')) return new Response(relayBody, { headers: { 'content-type': relayType } });
    return new Response('blocked', { status: 403 });
  };
  const result = await fetchModernGovWhatsNew();
  return { result, requested };
}

{
  const { result, requested } = await run(meetingsOnly);
  const [health] = result.health;
  assert.equal(result.items.length, 0);
  assert.equal(health.ok, true);
  assert.equal(health.status, 'empty');
  assert.match(health.error, /5 meeting or other notices skipped/);
  assert.equal(sourceStateFor(health), 'no-new-records', 'a quiet week is not a failure');
  assert.equal(requested.length, 1, 'fallbacks are skipped when the official feed answered');
}

{
  const { result } = await run(withAgenda);
  assert.equal(result.items.length, 1);
  assert.match(result.items[0].title, /^Agenda published: /);
  assert.equal(sourceStateFor(result.health[0]), 'current');
}

{
  // A non-feed answer (e.g. a challenge page) is not trusted: fallbacks run and,
  // when they fail too, the source is unavailable.
  const { result, requested } = await run('<html><body>Just a moment...</body></html>', 'text/html');
  assert.ok(requested.length > 1, 'fallbacks tried');
  assert.equal(result.health[0].ok, false);
  assert.equal(sourceStateFor(result.health[0]), 'unavailable');
}

console.log('ModernGov tests passed');
