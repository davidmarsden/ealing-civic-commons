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

function decode(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  return parseResponse(response, 'jina-reader', directUrl, bridgeUrl);
}

async function tryBingIndex() {
  const phrases = [
    'Agenda published',
    'Minutes published',
    'Decision sheet published',
    'Issue published',
    'Decision published',
    'ePetition',
    'Publication of plan'
  ];
  const fragments = [];
  const bridgeUrls = [];

  for (const phrase of phrases) {
    const q = `site:ealing.moderngov.co.uk/mgWhatsNew.aspx "${phrase}" 2026`;
    const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`;
    bridgeUrls.push(url);
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { accept: 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.5', 'user-agent': browserHeaders['user-agent'] }
    });
    if (!response.ok) continue;
    const xml = await response.text();
    for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) || []) {
      const title = decode(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '');
      const description = decode(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
      const link = decode(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '');
      if (!/ealing\.moderngov\.co\.uk\/mgWhatsNew\.aspx/i.test(link)) continue;
      fragments.push(`${title} ${description}`);
    }
  }

  const indexedText = fragments.join('\n');
  const items = parseItems(indexedText, directUrl);
  if (!items.length) {
    const excerpt = indexedText.slice(0, 500).replace(/\s+/g, ' ').trim();
    return { result: null, diagnostic: `bing-index: no supported updates (${excerpt || 'no matching indexed snippets'})` };
  }
  return {
    result: { items, sourceUrl: directUrl, bridgeUrl: bridgeUrls[0], mode: 'bing-index' },
    diagnostic: `bing-index: ${items.length} updates from ${fragments.length} indexed snippets`
  };
}

const diagnostics = [];
let result = null;
for (const attempt of [tryDirect, tryTranslate, tryJina, tryBingIndex]) {
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
