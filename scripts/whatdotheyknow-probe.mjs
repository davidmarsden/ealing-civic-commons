#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DEFAULT_BASE_URL, EALING_AUTHORITY_SLUG, normalizeRequestJson, parseAuthorityAtom } from './lib/whatdotheyknow.mjs';

const outputArg = process.argv.find(v => v.startsWith('--output='));
const output = resolve(outputArg ? outputArg.slice(9) : 'whatdotheyknow-probe.json');
const baseUrl = process.env.WDTK_BASE_URL || DEFAULT_BASE_URL;
const authoritySlug = process.env.WDTK_AUTHORITY_SLUG || EALING_AUTHORITY_SLUG;
const headers = { accept: 'application/json, application/atom+xml, application/xml;q=0.9,*/*;q=0.8', 'user-agent': 'EalingCivicCommons/0.1 (+https://ealing.civiccommons.co.uk)' };

async function get(url) {
  const response = await fetch(url, { headers, redirect: 'follow' });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${response.url}`);
  return { response, body };
}

const report = { generated_at: new Date().toISOString(), source: 'WhatDoTheyKnow', base_url: baseUrl, authority_slug: authoritySlug, ok: false, endpoints: {}, sample: null, errors: [] };
try {
  const authorityUrl = `${baseUrl}/body/${authoritySlug}`;
  const authority = await get(authorityUrl);
  report.endpoints.authority = { url: authorityUrl, status: authority.response.status, final_url: authority.response.url };
  if (!new URL(authority.response.url).pathname.includes(`/body/${authoritySlug}`)) throw new Error(`Authority slug did not resolve canonically: ${authority.response.url}`);

  let feed;
  const feedCandidates = [`${authorityUrl}/feed`, `${authorityUrl}.atom`, `${authorityUrl}?format=atom`];
  for (const url of feedCandidates) {
    try {
      const result = await get(url);
      const items = parseAuthorityAtom(result.body, { baseUrl, authoritySlug });
      if (items.length) { feed = { result, items, url }; break; }
    } catch (error) { report.errors.push(`feed candidate ${url}: ${error.message}`); }
  }
  if (!feed) throw new Error('No structured authority request feed could be parsed');
  report.endpoints.feed = { url: feed.url, status: feed.result.response.status, final_url: feed.result.response.url, items: feed.items.length };

  const summary = feed.items[0];
  const requestJsonUrl = `${summary.url}.json`;
  const requestJson = await get(requestJsonUrl);
  let payload;
  try { payload = JSON.parse(requestJson.body); } catch { throw new Error(`Expected JSON from ${requestJsonUrl}`); }
  const normalized = normalizeRequestJson(payload, { baseUrl, authoritySlug, fallback: summary });
  report.endpoints.request_json = { url: requestJsonUrl, status: requestJson.response.status, final_url: requestJson.response.url };
  report.sample = { sourceId: normalized.sourceId, url: normalized.url, title: normalized.title, status: normalized.status, correspondence: normalized.correspondence.length, attachments: normalized.attachments.length };
  report.ok = true;
} catch (error) { report.errors.push(error.message); }

await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`WhatDoTheyKnow probe written to ${output}`);
console.log(`${report.ok ? 'OK' : 'FAIL'} authority=${authoritySlug}${report.sample ? ` sample=${report.sample.sourceId}` : ''}`);
for (const error of report.errors) console.log(`- ${error}`);
if (!report.ok) process.exitCode = 2;
