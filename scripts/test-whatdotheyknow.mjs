#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeRequestJson, parseAuthorityAtom } from './lib/whatdotheyknow.mjs';

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
