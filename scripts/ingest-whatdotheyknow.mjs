#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, normalizeRequestJson, parseAuthorityAtom } from './lib/whatdotheyknow.mjs';

const outputArg = process.argv.find(v => v.startsWith('--output='));
const limitArg = process.argv.find(v => v.startsWith('--limit='));
const output = resolve(outputArg ? outputArg.slice(9) : 'whatdotheyknow-ingest.json');
const limit = Math.max(1, Math.min(50, Number(limitArg?.slice(8) || 10)));
const baseUrl = process.env.WDTK_BASE_URL || DEFAULT_BASE_URL;
const authoritySlug = process.env.WDTK_AUTHORITY_SLUG || EALING_AUTHORITY_SLUG;
const authorityUrl = `${baseUrl}/body/${authoritySlug}`;
const headers = { 'user-agent': 'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)', accept: 'application/json,application/atom+xml,application/xml;q=0.9,*/*;q=0.8' };

async function get(url) { const response = await fetch(url, { headers, redirect: 'follow' }); const body = await response.text(); if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${response.url}`); return { response, body }; }
async function discoverFeed() {
  const errors = [];
  for (const url of [`${authorityUrl}/feed`, `${authorityUrl}.atom`, `${authorityUrl}?format=atom`]) {
    try { const result = await get(url); const items = parseAuthorityAtom(result.body, { baseUrl, authoritySlug }); if (items.length) return { url, items }; }
    catch (error) { errors.push(`${url}: ${error.message}`); }
  }
  throw new Error(`No structured authority feed parsed (${errors.join('; ')})`);
}

const preview = { generated_at: new Date().toISOString(), purpose: 'preview-only; does not publish to Commons archive', source: 'WhatDoTheyKnow', authority_slug: authoritySlug, authority_url: authorityUrl, ok: false, feed_url: null, requested_limit: limit, records_discovered: 0, records_normalized: 0, records_rejected: 0, errors: [], records: [] };
try {
  const authority = await get(authorityUrl);
  if (!new URL(authority.response.url).pathname.includes(`/body/${authoritySlug}`)) throw new Error(`Authority slug did not resolve canonically: ${authority.response.url}`);
  const feed = await discoverFeed();
  preview.feed_url = feed.url;
  preview.records_discovered = feed.items.length;
  for (const summary of feed.items.slice(0, limit)) {
    try {
      const response = await get(`${summary.url}.json`);
      const payload = JSON.parse(response.body);
      preview.records.push(normalizeRequestJson(payload, { baseUrl, authoritySlug, fallback: summary }));
    } catch (error) { preview.records_rejected += 1; preview.errors.push(`${summary.sourceId}: ${error.message}`); }
  }
  preview.records_normalized = preview.records.length;
  preview.ok = preview.records.length > 0;
} catch (error) { preview.errors.push(error.message); }
await writeFile(output, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
console.log(`WhatDoTheyKnow ingest preview written to ${output}`);
console.log(`${preview.ok ? 'OK' : 'FAIL'} discovered=${preview.records_discovered} normalized=${preview.records_normalized} rejected=${preview.records_rejected}`);
for (const error of preview.errors) console.log(`- ${error}`);
if (!preview.ok) process.exitCode = 2;
