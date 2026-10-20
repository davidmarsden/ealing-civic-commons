#!/usr/bin/env node
// Drives netlify/functions/archive-index-check.mjs on a deploy preview, then checks
// public endpoints' headers and response times against a baseline (production).
//
//   PREVIEW_URL=https://deploy-preview-165--ealing-civic-commons.netlify.app \
//   BASELINE_URL=https://ealing.civiccommons.co.uk \
//   ARCHIVE_CHECK_TOKEN=... node scripts/archive-index-preview-check.mjs
//
// Production is only read: the harness copies items into the preview's own
// deploy-scoped store and builds/compares the index there. Writes a JSON report to
// archive-index-preview-report.json.
import { writeFile } from 'node:fs/promises';

const preview = String(process.env.PREVIEW_URL || '').replace(/\/$/, '');
const baseline = String(process.env.BASELINE_URL || '').replace(/\/$/, '');
const token = process.env.ARCHIVE_CHECK_TOKEN;
const samples = Number(process.env.TIMING_SAMPLES || 7);
if (!preview || !token) {
  console.error('Set PREVIEW_URL and ARCHIVE_CHECK_TOKEN (BASELINE_URL optional).');
  process.exit(2);
}

const report = { preview, baseline: baseline || null, startedAt: new Date().toISOString(), steps: {} };
const harness = async query => {
  const response = await fetch(`${preview}/.netlify/functions/archive-index-check?${query}`, { headers: { 'x-archive-check-token': token } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${query}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return body;
};
const log = (...args) => console.log(...args);

// 1. Seed the preview's deploy store from production (read-only on production).
report.steps.statusBefore = await harness('action=status');
log('status', report.steps.statusBefore);
if (report.steps.statusBefore.deployItems < report.steps.statusBefore.productionItems) {
  const seeded = [];
  for (let offset = 0; offset !== null;) {
    const chunk = await harness(`action=seed&offset=${offset}&limit=300`);
    seeded.push({ offset, copied: chunk.copied, missing: chunk.missing, ms: chunk.ms });
    log('seed', offset, chunk.copied, `${chunk.ms}ms`);
    offset = chunk.nextOffset;
  }
  report.steps.seed = seeded;
}

// 2. Reconcile until complete (stands in for the scheduled archiver, which may not
//    run on previews), then once more to measure the steady-state cost.
const passes = [];
for (let i = 0; i < 20; i += 1) {
  const pass = await harness('action=reconcile&backfill=2000');
  passes.push({ backfilled: pass.indexBackfilled, complete: pass.searchIndexComplete, size: pass.searchIndexSize, bytes: pass.searchIndexBytes, wallMs: pass.wallMs, timings: pass.timings, ops: pass.ops });
  log('reconcile', passes.at(-1));
  if (pass.searchIndexComplete) break;
}
report.steps.reconcile = passes;
report.steps.steadyState = [];
for (let i = 0; i < 3; i += 1) {
  const pass = await harness('action=reconcile');
  report.steps.steadyState.push({ wallMs: pass.wallMs, timings: pass.timings, ops: pass.ops, written: pass.searchIndexWritten, complete: pass.searchIndexComplete });
}
log('steady state', report.steps.steadyState);
report.steps.statusAfter = await harness('action=status');

// 3. Indexed vs full scan on identical data, plus a full pagination walk.
const { cases } = await harness('action=cases');
report.steps.compare = [];
for (let i = 0; i < cases.length; i += 1) {
  const result = await harness(`action=compare&case=${i}`);
  report.steps.compare.push(result);
  log('compare', JSON.stringify(result.query), result.match ? 'match' : `DIFF ${result.differences}`, `indexed ${result.indexed.ms}ms / scan ${result.scan.ms}ms`);
}
report.steps.walk = await harness('action=walk');
log('walk', report.steps.walk);

// 4. Public endpoints: headers and timings (cache-busted so each request reaches the function).
const endpoints = [
  '/.netlify/functions/civic-archive?limit=40',
  '/.netlify/functions/civic-archive?limit=40&offset=40',
  '/.netlify/functions/civic-archive?limit=40&q=council',
  '/.netlify/functions/historical-reporting?term=southall&limit=20',
  '/.netlify/functions/combined-feed'
];
const timeEndpoint = async (origin, path) => {
  const times = [];
  let headers = null, status = null;
  for (let i = 0; i < samples; i += 1) {
    const url = `${origin}${path}${path.includes('?') ? '&' : '?'}_cb=${Date.now()}-${i}`;
    const started = performance.now();
    const response = await fetch(url);
    await response.arrayBuffer();
    times.push(Math.round(performance.now() - started));
    status = response.status;
    headers = { 'cache-control': response.headers.get('cache-control'), 'netlify-cdn-cache-control': response.headers.get('netlify-cdn-cache-control'), 'cache-status': response.headers.get('cache-status') };
  }
  const sorted = [...times].sort((a, b) => a - b);
  return { status, medianMs: sorted[Math.floor(sorted.length / 2)], p90Ms: sorted[Math.floor(sorted.length * 0.9)], times, headers };
};
report.steps.endpoints = [];
for (const path of endpoints) {
  const entry = { path, preview: await timeEndpoint(preview, path) };
  if (baseline) entry.baseline = await timeEndpoint(baseline, path);
  report.steps.endpoints.push(entry);
  log('endpoint', path, 'preview', entry.preview.medianMs, 'ms', baseline ? `baseline ${entry.baseline.medianMs} ms` : '');
}

// Error responses must not be cached.
const errorResponse = await fetch(`${preview}/.netlify/functions/civic-archive`, { method: 'POST' });
report.steps.errorHeaders = { status: errorResponse.status, 'cache-control': errorResponse.headers.get('cache-control'), 'cache-status': errorResponse.headers.get('cache-status') };

const failures = [];
if (!passes.at(-1)?.complete) failures.push('index did not complete');
if (report.steps.steadyState.some(pass => pass.written)) failures.push('steady-state reconcile rewrote the index');
for (const result of report.steps.compare) if (!result.match) failures.push(`compare mismatch ${JSON.stringify(result.query)}: ${result.differences}`);
const walk = report.steps.walk;
if (walk.error || walk.duplicates || walk.missing || walk.unexpected || !walk.newestFirst) failures.push(`pagination walk: ${JSON.stringify(walk)}`);
for (const entry of report.steps.endpoints) {
  if (entry.preview.status !== 200) failures.push(`${entry.path} HTTP ${entry.preview.status}`);
  // Netlify consumes Netlify-CDN-Cache-Control and strips it from responses; the
  // Cache-Status header shows whether the durable cache stored the response.
  if (!/"Netlify Durable";[^,]*stored/.test(entry.preview.headers['cache-status'] || '')) failures.push(`${entry.path} not stored in the durable cache: ${entry.preview.headers['cache-status']}`);
}
if (report.steps.errorHeaders['cache-control'] !== 'no-store' || /stored/.test(report.steps.errorHeaders['cache-status'] || '')) failures.push(`error response cacheable: ${JSON.stringify(report.steps.errorHeaders)}`);
report.failures = failures;
report.finishedAt = new Date().toISOString();
await writeFile('archive-index-preview-report.json', JSON.stringify(report, null, 2));
log(failures.length ? `FAILED:\n- ${failures.join('\n- ')}` : 'All preview checks passed.', '\nReport: archive-index-preview-report.json');
process.exit(failures.length ? 1 : 0);
