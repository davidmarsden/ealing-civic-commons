#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const target = process.argv[2] || '/opt/rsschat/rssnetwork.js';
const baseUrlArg = process.argv.find(arg => arg.startsWith('--url='));
const baseUrl = baseUrlArg ? baseUrlArg.slice('--url='.length).replace(/\/$/, '') : null;

const source = fs.readFileSync(target, 'utf8');
const required = [
  'COMMONS CHAT OVERLAY: product identity',
  'COMMONS CHAT OVERLAY: civic bindings',
  'commonsObjectUrl',
  'commonsObjectType',
  'function addCommonsBindingsToRss',
  'function getCommonsDiscussions',
  'function localBindCommons',
  'case "/getcommonsdiscussions"',
  'case "/localbindcommons"',
  'case "/manifest.webmanifest"',
  'case "/sw.js"',
  'COMMONS CHAT OVERLAY: PWA',
  'https://civiccommons.co.uk/ns/commons-chat/1.0'
];

let failed = false;
for (const marker of required) {
  const ok = source.includes(marker);
  console.log((ok ? 'OK   ' : 'FAIL ') + marker);
  if (!ok) failed = true;
}

const syntax = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
if (syntax.status === 0) {
  console.log('OK   node --check');
} else {
  failed = true;
  console.log('FAIL node --check');
  process.stderr.write(syntax.stderr || syntax.stdout || '');
}

if (baseUrl) {
  try {
    const url = new URL('/getcommonsdiscussions', baseUrl);
    url.searchParams.set('url', 'https://ealing.civiccommons.co.uk/items/verification-probe');
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    const ok = response.ok &&
      typeof data.conversationCount === 'number' &&
      typeof data.postCount === 'number' &&
      Array.isArray(data.threads);
    console.log((ok ? 'OK   ' : 'FAIL ') + 'GET /getcommonsdiscussions smoke test');
    if (!ok) failed = true;

    const manifestResponse = await fetch(new URL('/manifest.webmanifest', baseUrl), { signal: AbortSignal.timeout(5000) });
    const manifest = await manifestResponse.json();
    const manifestOk = manifestResponse.ok && manifest.name === 'Commons Chat — Ealing Civic Commons' && manifest.display === 'standalone';
    console.log((manifestOk ? 'OK   ' : 'FAIL ') + 'GET /manifest.webmanifest smoke test');
    if (!manifestOk) failed = true;

    const swResponse = await fetch(new URL('/sw.js', baseUrl), { signal: AbortSignal.timeout(5000) });
    const swText = await swResponse.text();
    const swOk = swResponse.ok && /serviceWorker|addEventListener\(["']fetch/.test(swText);
    console.log((swOk ? 'OK   ' : 'FAIL ') + 'GET /sw.js smoke test');
    if (!swOk) failed = true;
  } catch (error) {
    failed = true;
    console.log('FAIL Commons Chat HTTP smoke tests: ' + error.message);
  }
}

process.exit(failed ? 1 : 0);
