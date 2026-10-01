#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const sourceArg = process.argv.find(arg => arg.startsWith('--source='));
const inputArg = process.argv.find(arg => arg.startsWith('--input='));
const archiveArg = process.argv.find(arg => arg.startsWith('--archive='));
const sourceUrl = sourceArg?.slice('--source='.length) || 'https://planning-records.uk/ealing/';
const inputPath = inputArg?.slice('--input='.length) || null;
const archivePath = archiveArg?.slice('--archive='.length) || 'public/data/planning-archive.json';
const generatedAt = new Date().toISOString();
const towns = ['Southall', 'Perivale', 'Acton', 'Greenford', 'Hanwell', 'Northolt'];

function decode(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function strip(value = '') {
  return decode(String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function isoDate(value = '') {
  const match = String(value).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})$/);
  if (!match) return null;
  const months = { january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',jan:'01',feb:'02',mar:'03',apr:'04',jun:'06',jul:'07',aug:'08',sep:'09',sept:'09',oct:'10',nov:'11',dec:'12' };
  const month = months[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${String(match[1]).padStart(2, '0')}` : null;
}

function townFromAddress(address) {
  const text = String(address || '');
  for (const town of towns) if (new RegExp(`\\b${town}\\b`, 'i').test(text)) return town;
  if (/\bEaling\b/i.test(text) && /\bW(?:5|13)\b/i.test(text) && !/\bChiswick\b/i.test(text)) return 'Ealing';
  return null;
}

function outOfBorough(reference, proposal) {
  return /out of borough/i.test(String(proposal || '')) || /OPDCOB$/i.test(String(reference || ''));
}

function category(reference, proposal) {
  const ref = String(reference || '');
  const text = String(proposal || '').toLowerCase();
  if (outOfBorough(ref, text)) return 'Out of borough';
  if (/(?:PTC|PTT)$/i.test(ref) || /^t\d\b/.test(text) || /^tpo\d*/.test(text)) return 'Tree works';
  if (/prior approval/.test(text) || /PALHE$/i.test(ref)) return 'Prior approval';
  if (/discharge of condition/.test(text) || /CND$/i.test(ref)) return 'Conditions';
  return 'Planning application';
}

function atlasUrl(reference) {
  return `https://www.planningatlas.co.uk/atlas/ealing/applications/${encodeURIComponent(String(reference || '').trim())}`;
}

function parseRows(html) {
  const rows = [];
  for (const match of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => strip(cell[1]));
    if (cells.length < 5) continue;
    const [reference, address, proposal, status, date] = cells;
    if (!reference || !/^[A-Z0-9-]{4,}$/i.test(reference)) continue;
    const validatedDate = isoDate(date);
    if (!validatedDate) continue;
    rows.push({ reference: reference.trim(), address, proposal, status, validated_date: validatedDate });
  }
  const deduped = new Map();
  for (const row of rows) if (!deduped.has(row.reference.toLowerCase())) deduped.set(row.reference.toLowerCase(), row);
  return [...deduped.values()];
}

async function sourceHtml() {
  if (inputPath) return readFile(inputPath, 'utf8');
  const response = await fetch(sourceUrl, { headers: { 'user-agent': 'Ealing-Civic-Commons/1.0 (+https://ealing.civiccommons.co.uk/)', accept: 'text/html' } });
  if (!response.ok) throw new Error(`Planning-Records fetch failed: HTTP ${response.status}`);
  return response.text();
}

const archive = JSON.parse(await readFile(archivePath, 'utf8'));
if (!Array.isArray(archive.records)) throw new Error(`Invalid planning archive: ${archivePath}`);
const html = await sourceHtml();
const rows = parseRows(html);
if (rows.length < 1000) throw new Error(`Planning-Records bootstrap found only ${rows.length} rows; refusing to update archive`);

const byReference = new Map(archive.records.map(record => [String(record.reference || '').toLowerCase(), record]));
let added = 0;
let provenanceAdded = 0;

for (const row of rows) {
  const key = row.reference.toLowerCase();
  const sourceRef = { source: 'Planning-Records.uk', url: sourceUrl, imported_at: generatedAt };
  const existing = byReference.get(key);
  if (existing) {
    const refs = Array.isArray(existing.reference_sources) ? existing.reference_sources : [];
    if (!refs.some(ref => ref?.source === 'Planning-Records.uk')) {
      byReference.set(key, { ...existing, reference_sources: [...refs, sourceRef], planning_atlas_url: existing.planning_atlas_url || atlasUrl(row.reference) });
      provenanceAdded += 1;
    }
    continue;
  }

  const town = townFromAddress(row.address);
  const record = {
    id: `planning:ealing:${row.reference.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: 'planning-application',
    authority: 'London Borough of Ealing',
    reference: row.reference,
    address: row.address,
    proposal: row.proposal,
    status: row.status,
    validated_date: row.validated_date,
    authoritative_url: null,
    town,
    category: category(row.reference, row.proposal),
    out_of_borough: outOfBorough(row.reference, row.proposal),
    commons_path: `/planning/${row.reference.toLowerCase()}`,
    place_links: town ? [{ route: `places/${town.toLowerCase()}`, label: town, relationship: 'located_in', provenance: 'town-classification' }] : [],
    planning_atlas_url: atlasUrl(row.reference),
    archive_origin: 'historical-backfill',
    first_seen_week: null,
    last_seen_week: null,
    first_seen_at: generatedAt,
    last_seen_at: generatedAt,
    weeks_seen: [],
    history: [{ observed_at: generatedAt, week: null, address: row.address, proposal: row.proposal, status: row.status, validated_date: row.validated_date, authoritative_url: null, town, category: category(row.reference, row.proposal), out_of_borough: outOfBorough(row.reference, row.proposal), place_links: town ? [{ route: `places/${town.toLowerCase()}`, label: town, relationship: 'located_in', provenance: 'town-classification' }] : [] }],
    reference_sources: [sourceRef],
  };
  byReference.set(key, record);
  added += 1;
}

if (!added && !provenanceAdded) {
  console.log(`Planning-Records bootstrap is already applied: ${rows.length} source rows checked, no archive changes.`);
  process.exit(0);
}

archive.archive_version = Math.max(Number(archive.archive_version || 1), 2);
archive.generated_at = generatedAt;
archive.bootstrap_sources = Array.isArray(archive.bootstrap_sources) ? archive.bootstrap_sources.filter(source => source?.name !== 'Planning-Records.uk') : [];
archive.bootstrap_sources.push({ name: 'Planning-Records.uk', url: sourceUrl, imported_at: generatedAt, rows_checked: rows.length });
archive.records = [...byReference.values()].sort((a, b) => {
  const dateDelta = (Date.parse(b.validated_date || '') || 0) - (Date.parse(a.validated_date || '') || 0);
  return dateDelta || String(a.reference || '').localeCompare(String(b.reference || ''));
});

await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
console.log(`Planning-Records bootstrap checked ${rows.length} row(s): added ${added} historical record(s), attached provenance to ${provenanceAdded} existing record(s).`);
