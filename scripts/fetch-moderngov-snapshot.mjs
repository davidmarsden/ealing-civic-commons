import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { listingUrl, parseItems } from '../netlify/functions/moderngov-whatsnew.mjs';

const outputPath = 'public/data/moderngov-whatsnew.json';
const directUrl = listingUrl();
const started = Date.now();

const browserHeaders = {
  accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  'accept-language': 'en-GB,en;q=0.9',
  referer: 'https://ealing.moderngov.co.uk/mgWhatsNew.aspx?bcr=1',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
};

async function parseResponse(response, mode, sourceUrl, bridgeUrl = null) {
  if (!response.ok) return { result: null, diagnostic: `${mode}: HTTP ${response.status}` };
  const body = await response.text();
  const items = parseItems(body, sourceUrl);
  if (!items.length) {
    const excerpt = body.slice(0, 500).replace(/\s+/g, ' ').trim();
    return { result: null, diagnostic: `${mode}: no supported updates (${excerpt})` };
  }
  return { result: { items, sourceUrl, bridgeUrl, mode }, diagnostic: `${mode}: ${items.length} updates` };
}

async function tryDirect() {
  const response = await fetch(directUrl, { redirect: 'follow', headers: browserHeaders });
  return parseResponse(response, 'direct', response.url || directUrl);
}

function translateUrl() {
  const original = new URL(directUrl);
  const translated = new URL(`https://ealing-moderngov-co-uk.translate.goog${original.pathname}`);
  for (const [key, value] of original.searchParams) translated.searchParams.set(key, value);
  translated.searchParams.set('_x_tr_sl', 'auto');
  translated.searchParams.set('_x_tr_tl', 'en');
  translated.searchParams.set('_x_tr_hl', 'en-GB');
  return translated.toString();
}

async function tryTranslate() {
  const bridgeUrl = translateUrl();
  const response = await fetch(bridgeUrl, { redirect: 'follow', headers: browserHeaders });
  return parseResponse(response, 'google-translate-bridge', directUrl, bridgeUrl);
}

async function tryJina() {
  const bridgeUrl = `https://r.jina.ai/http://${directUrl.replace(/^https?:\/\//, '')}`;
  const response = await fetch(bridgeUrl, {
    redirect: 'follow',
    headers: { accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.5', 'user-agent': 'Ealing-Civic-Commons/1.0' }
  });
  if (!response.ok) return { result: null, diagnostic: `jina-reader: HTTP ${response.status}` };
  const body = await response.text();
  // Jina often returns the original HTML structure as readable text; convert
  // Markdown bullet leaders to plain spacing so the same event regex can run.
  const items = parseItems(body.replace(/^\s*[*-]\s+/gm, ' '), directUrl);
  if (!items.length) {
    const excerpt = body.slice(0, 500).replace(/\s+/g, ' ').trim();
    return { result: null, diagnostic: `jina-reader: no supported updates (${excerpt})` };
  }
  return { result: { items, sourceUrl: directUrl, bridgeUrl, mode: 'jina-reader' }, diagnostic: `jina-reader: ${items.length} updates` };
}

const diagnostics = [];
let result = null;
for (const attempt of [tryDirect, tryTranslate, tryJina]) {
  try {
    const outcome = await attempt();
    diagnostics.push(outcome.diagnostic);
    if (outcome.result) { result = outcome.result; break; }
  } catch (error) {
    diagnostics.push(`${attempt.name}: ${error?.message || error}`);
  }
}

if (!result) throw new Error(`ModernGov snapshot unavailable. ${diagnostics.join(' | ')}`);

const snapshot = {
  generatedAt: new Date().toISOString(),
  sourceUrl: result.sourceUrl,
  bridgeUrl: result.bridgeUrl || null,
  mode: result.mode,
  fetchMs: Date.now() - started,
  diagnostics,
  items: result.items
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote ${result.items.length} ModernGov publication updates to ${outputPath} via ${result.mode}`);
