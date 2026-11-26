#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRequestJson, parseAuthorityAtom, stateFromSummary } from './lib/whatdotheyknow.mjs';
import { repairWhatDoTheyKnowItem, whatDoTheyKnowCommonsItem } from './lib/whatdotheyknow-commons.mjs';

const fixture = JSON.parse(await readFile(new URL('./data/whatdotheyknow-ealing-fixture.json', import.meta.url), 'utf8'));
const normalized = normalizeRequestJson(fixture);
assert.equal(normalized.sourceId, 'yvyt_southall_community_fund_202');
assert.equal(normalized.authority.urlName, 'ealing_borough_council');
assert.equal(normalized.correspondence.length, 1);
assert.equal(normalized.attachments.length, 2);
assert.equal(normalized.attachments[0].name, 'image001.png');
assert.ok(!('requester' in normalized), 'requester metadata must not create a Person/entity field');
assert.deepEqual(normalizeRequestJson(fixture), normalized, 'normalisation must be deterministic');

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Example request</title><link href="https://www.whatdotheyknow.com/request/example_request"/><published>2026-09-20T10:00:00Z</published><updated>2026-09-21T10:00:00Z</updated><summary>Example summary</summary></entry></feed>`;
const parsed = parseAuthorityAtom(atom);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].sourceId, 'example_request');
assert.equal(parsed[0].title, 'Example request');
assert.equal(parsed[0].authority.urlName, 'ealing_borough_council');

console.log('WhatDoTheyKnow Atom parsing, request normalisation, attachments and deterministic identity OK.');

// Relay feed: chat-dev host in links, two icon classes, status in <strong>.
const relayAtom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>tag:chat-dev.ealing.civiccommons.co.uk,2005:InfoRequestEvent/20977682</id><published>2026-11-26T18:06:46+00:00</published><link type="text/html" rel="alternate" href="https://chat-dev.ealing.civiccommons.co.uk/request_event/20977682"/><title type="html">Food Officers</title><content type="html">&lt;div class=&quot;requester&quot;&gt;Response by &lt;a href=&quot;https://chat-dev.ealing.civiccommons.co.uk/body/ealing_borough_council&quot;&gt;Ealing Borough Council&lt;/a&gt; on 26 November 2026.&lt;/div&gt;&lt;p&gt;&lt;i class=&quot;icon-standalone icon_partially_successful&quot;&gt;&lt;/i&gt;&lt;strong&gt; Partially successful &lt;/strong&gt;&lt;/p&gt;</content></entry></feed>`;
const relayParsed = parseAuthorityAtom(relayAtom);
assert.equal(relayParsed.length, 1);
assert.equal(relayParsed[0].url, 'https://www.whatdotheyknow.com/request_event/20977682', 'relay host must be rewritten to WDTK');
assert.equal(relayParsed[0].status, 'partially_successful', 'state must come from the icon_ class, not icon-standalone');
assert.equal(stateFromSummary('Request sent by X on 3 October 2026 . Long overdue. Dear'), 'waiting_response_very_overdue');
assert.equal(stateFromSummary('Nothing here is Successful'), null, 'labels only count straight after the date');

const legacy = whatDoTheyKnowCommonsItem({ ...relayParsed[0], url: 'https://chat-dev.ealing.civiccommons.co.uk/request_event/1', status: 'standalone', summary: 'Response by Ealing Borough Council to maggie on 26 November 2026 . Awaiting classification Thank you' });
const repaired = repairWhatDoTheyKnowItem(legacy);
assert.equal(repaired.url, 'https://www.whatdotheyknow.com/request_event/1');
assert.equal(repaired.mutableSource.status, 'waiting_classification');
assert.equal(repairWhatDoTheyKnowItem(repaired), null, 'repair must be idempotent');
console.log('WhatDoTheyKnow relay links, states and archive repair OK.');
