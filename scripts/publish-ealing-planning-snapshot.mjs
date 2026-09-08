#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';

const input = process.argv[2] || 'ealing-planning-ingest.json';
const output = process.argv[3] || 'public/data/planning-latest.json';
const towns = ['Southall', 'Perivale', 'Acton', 'Greenford', 'Hanwell', 'Northolt'];

function isoDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return value;
  const months = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
  return `${match[3]}-${months[match[2]]}-${String(match[1]).padStart(2,'0')}`;
}

function townFromAddress(address) {
  const text = String(address || '');
  for (const town of towns) if (new RegExp(`\\b${town}\\b`, 'i').test(text)) return town;
  if (/\bEaling\b/i.test(text) && /\bW(?:5|13)\b/i.test(text) && !/\bChiswick\b/i.test(text)) return 'Ealing';
  return null;
}

function isOutOfBorough(record) {
  const ref = String(record.reference || '');
  const proposal = String(record.proposal || '');
  return /out of borough/i.test(proposal) || /OPDCOB$/i.test(ref);
}

function category(record) {
  const ref = String(record.reference || '');
  const proposal = String(record.proposal || '').toLowerCase();
  if (isOutOfBorough(record)) return 'Out of borough';
  if (/(?:PTC|PTT)$/i.test(ref) || /^t\d\b/.test(proposal) || /^tpo\d*/.test(proposal)) return 'Tree works';
  if (/prior approval/.test(proposal) || /PALHE$/i.test(ref)) return 'Prior approval';
  if (/discharge of condition/.test(proposal) || /CND$/i.test(ref)) return 'Conditions';
  return 'Planning application';
}

const ingest = JSON.parse(await readFile(input, 'utf8'));
if (!ingest.ok || !Array.isArray(ingest.records) || !ingest.records.length) {
  throw new Error('Planning ingest did not contain publishable records');
}

const discovered = Number(ingest.applications_discovered ?? 0);
const normalized = Number(ingest.applications_normalized ?? ingest.records.length);
const rejected = Number(ingest.records_rejected ?? 0);
const errors = Array.isArray(ingest.errors) ? ingest.errors.length : 0;
if (!discovered || normalized !== discovered || ingest.records.length !== discovered || rejected !== 0 || errors !== 0) {
  throw new Error(`Refusing to replace planning snapshot with incomplete ingest: discovered=${discovered}, normalized=${normalized}, records=${ingest.records.length}, rejected=${rejected}, errors=${errors}`);
}

for (const [index, record] of ingest.records.entries()) {
  if (!String(record.reference || '').trim()) {
    throw new Error(`Refusing to publish planning record ${index + 1}: application reference is missing`);
  }
}

const snapshot = {
  generated_at: ingest.generated_at,
  week: ingest.week,
  source: ingest.source,
  canonical_source: 'Ealing Council Planning Register',
  records: ingest.records.map((record) => {
    const reference = String(record.reference).trim();
    return {
      id: record.id,
      reference,
      address: record.address,
      proposal: record.proposal,
      status: record.status,
      validated_date: isoDate(record.validated_date),
      authoritative_url: record.authoritative_url,
      town: townFromAddress(record.address),
      category: category(record),
      out_of_borough: isOutOfBorough(record),
      commons_path: `/planning/${reference.toLowerCase()}`,
    };
  }),
};

await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Published ${snapshot.records.length} planning records from weekly list ${snapshot.week} to ${output}.`);
