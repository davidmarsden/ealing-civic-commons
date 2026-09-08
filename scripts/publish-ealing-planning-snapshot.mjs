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

function category(record) {
  const ref = String(record.reference || '');
  const proposal = String(record.proposal || '').toLowerCase();
  if (/out of borough/.test(proposal) || /OPDCOB$/.test(ref)) return 'Out of borough';
  if (/(?:PTC|PTT)$/.test(ref) || /^t\d\b/.test(proposal) || /^tpo\d*/.test(proposal)) return 'Tree works';
  if (/prior approval/.test(proposal) || /PALHE$/.test(ref)) return 'Prior approval';
  if (/discharge of condition/.test(proposal) || /CND$/.test(ref)) return 'Conditions';
  return 'Planning application';
}

const ingest = JSON.parse(await readFile(input, 'utf8'));
if (!ingest.ok || !Array.isArray(ingest.records) || !ingest.records.length) throw new Error('Planning ingest did not contain publishable records');

const snapshot = {
  generated_at: ingest.generated_at,
  week: ingest.week,
  source: ingest.source,
  canonical_source: 'Ealing Council Planning Register',
  records: ingest.records.map((record) => ({
    id: record.id,
    reference: record.reference,
    address: record.address,
    proposal: record.proposal,
    status: record.status,
    validated_date: isoDate(record.validated_date),
    authoritative_url: record.authoritative_url,
    town: townFromAddress(record.address),
    category: category(record),
    out_of_borough: /out of borough/i.test(record.proposal || ''),
    commons_path: `/planning/${String(record.reference || '').toLowerCase()}`,
  })),
};

await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Published ${snapshot.records.length} planning records from weekly list ${snapshot.week} to ${output}.`);
