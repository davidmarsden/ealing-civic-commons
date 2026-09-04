import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { listingUrl, parseItems } from '../netlify/functions/moderngov-whatsnew.mjs';

const outputPath = 'public/data/moderngov-whatsnew.json';
const directUrl = listingUrl();
const started = Date.now();
const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const SOURCE = { id: 'modern-gov', name: 'Ealing Council — ModernGov', homepage: 'https://ealing.moderngov.co.uk/', sourceClass: 'Official record' };

function publishedAt(value) {
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12)).toISOString() : null;
}

function cleanMarkdown(value = '') {
  return String(value)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]+/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function placeFor(text) {
  const value = String(text)
    .replace(/\bLondon Borough of Ealing(?: Council)?\b/gi, ' ')
    .replace(/\bEaling Council\b/gi, ' ')
    .replace(/\bEaling (?:Pension Fund|Pension Fund Panel|Pension Board|Audit and Governance Committee|Cabinet|Council|Health and Wellbeing Board|Scrutiny|Overview and Scrutiny Committee|Standards Committee)\b/gi, ' ');
  const patterns = {
    Ealing: /\b(?:Ealing Broadway|Ealing town|central Ealing|West Ealing|North Ealing|South Ealing)\b/i,
    Acton: /\bActon\b/i,
    Greenford: /\bGreenford\b/i,
    Hanwell: /\bHanwell\b/i,
    Northolt: /\bNortholt\b/i,
    Perivale: /\bPerivale\b/i,
    Southall: /\bSouthall\b/i
  };
  const towns = BOROUGH_TOWNS.filter(town => patterns[town].test(value));
  return { towns: towns.length ? towns : BOROUGH_TOWNS, boroughWide: towns.length === 0 };
}

function topicsFor(text) {
  const value = String(text).toLowerCase();
  const topics = [];
  const add = topic => { if (!topics.includes(topic)) topics.push(topic); };
  if (/planning|development|application|regeneration|construction/.test(value)) add('Planning & development');
  if (/housing|tenant|rent|homeless|temporary accommodation/.test(value)) add('Housing');
  if (/air quality|pollution|climate|park|tree|environment|recycling|waste/.test(value)) add('Environment');
  if (/traffic|transport|bus|rail|road|parking|cycle|street/.test(value)) add('Transport');
  if (/school|children|young people|youth|education|nursery/.test(value)) add('Schools & young people');
  if (/police|crime|safety|licensing|anti-social|antisocial/.test(value)) add('Policing & safety');
  if (/heritage|arts|culture|museum|conservation/.test(value)) add('Culture & history');
  add('Council & democracy');
  return topics.slice(0, 3);
}

function destinationNear(markdown, index, fallback) {
  const section = markdown.slice(index, index + 1800);
  const matches = [...section.matchAll(/https?:\/\/ealing\.moderngov\.co\.uk\/[^\s)<>"']+/gi)];
  for (const match of matches) {
    const url = match[0].replace(/[.,;]+$/g, '');
    if (!/mg(?:WhatsNew|Rss)\.aspx/i.test(url)) return url;
  }
  return fallback;
}

function parseReaderItems(markdown, fallbackUrl) {
  const items = [];
  const seen = new Set();
  const pattern = /(\d{1,2}\/\d{1,2}\/20\d{2})\s*(?:-|–|—)\s*(Agenda published|Minutes published|Decision sheet published|Issue published|Decision published|ePetition|Publication of plan)\s*:\s*([^\n\r]+)/gi;
  let match;
  while ((match = pattern.exec(markdown))) {
    const date = publishedAt(match[1]);
    const eventType = match[2].replace(/^epetition$/i, 'ePetition');
    const detail = cleanMarkdown(match[3]);
    if (!date || !detail) continue;
    const key = `${match[1]}|${eventType.toLowerCase()}|${detail.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = placeFor(detail);
    items.push({
      id: `${SOURCE.id}:${key}`,
      sourceId: SOURCE.id,
      source: SOURCE.name,
      sourceClass: SOURCE.sourceClass,
      sourceHomepage: SOURCE.homepage,
      mediaType: null,
      title: `${eventType}: ${detail}`,
      url: destinationNear(markdown, match.index, fallbackUrl),
      canonicalUrl: null,
      dedupeKey: `${SOURCE.id}:${key}`,
      summary: `Official ModernGov publication update: ${detail}`.slice(0, 420),
      publishedAt: date,
      towns: place.towns,
      boroughWide: place.boroughWide,
      topics: topicsFor(detail),
      derived: true,
      derivedFrom: 'Ealing ModernGov What’s new via public reader bridge',
      aiGenerated: false
    });
  }
  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 30);
}

async function fetchDirect() {
  const response = await fetch(directUrl, {
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
      'accept-language': 'en-GB,en;q=0.9',
      referer: 'https://ealing.moderngov.co.uk/mgWhatsNew.aspx?bcr=1',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    }
  });
  if (!response.ok) return null;
  const items = parseItems(await response.text(), response.url || directUrl);
  return items.length ? { items, sourceUrl: response.url || directUrl, mode: 'direct' } : null;
}

async function fetchReaderBridge() {
  const readerUrl = `https://r.jina.ai/http://${directUrl.replace(/^https?:\/\//, '')}`;
  const response = await fetch(readerUrl, {
    redirect: 'follow',
    headers: { accept: 'text/plain,text/markdown;q=0.9,*/*;q=0.5', 'user-agent': 'Ealing-Civic-Commons/1.0' }
  });
  if (!response.ok) throw new Error(`Reader bridge failed: HTTP ${response.status}`);
  const markdown = await response.text();
  const items = parseReaderItems(markdown, directUrl);
  if (!items.length) {
    const excerpt = markdown.slice(0, 1200).replace(/\s+/g, ' ').trim();
    throw new Error(`Reader bridge returned no supported ModernGov publication updates. Response excerpt: ${excerpt}`);
  }
  return { items, sourceUrl: directUrl, bridgeUrl: readerUrl, mode: 'reader-bridge' };
}

const result = await fetchDirect() || await fetchReaderBridge();
const snapshot = {
  generatedAt: new Date().toISOString(),
  sourceUrl: result.sourceUrl,
  bridgeUrl: result.bridgeUrl || null,
  mode: result.mode,
  fetchMs: Date.now() - started,
  items: result.items
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote ${result.items.length} ModernGov publication updates to ${outputPath} via ${result.mode}`);
