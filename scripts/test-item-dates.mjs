#!/usr/bin/env node
// Impossible future publication dates are treated as unknown, keeping the claim.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withPlausibleDate } from '../netlify/lib/item-dates.mjs';

const now = Date.parse('2026-10-21T09:00:00Z');
const met = { id: 'met', title: 'Southall West: current policing priorities', publishedAt: '2026-11-20T12:00:00.000Z' };
assert.deepEqual(withPlausibleDate(met, now), { ...met, publishedAt: null, claimedPublishedAt: '2026-11-20T12:00:00.000Z' });
// Within a day ahead (time zones, scheduled posts) and past dates are unchanged.
const soon = { id: 'soon', publishedAt: '2026-10-22T08:00:00Z' };
assert.equal(withPlausibleDate(soon, now), soon);
const past = { id: 'past', publishedAt: '2026-10-20T08:00:00Z' };
assert.equal(withPlausibleDate(past, now), past);
const undated = { id: 'none', publishedAt: null };
assert.equal(withPlausibleDate(undated, now), undated);

// The timeline build applies it before ordering (so such an item cannot top the homepage).
const build = await readFile('netlify/functions/combined-feed.mjs', 'utf8');
assert.ok(build.includes('coveragePreservingSlice([...(wdtk.items||[]),...(core.items||[])].map(item=>withPlausibleDate(item,now)))'), 'combined feed applies the rule before ordering');

console.log('item date tests passed');
