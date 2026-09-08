#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const dir = await mkdtemp(join(tmpdir(), 'planning-history-'));
const latestPath = join(dir, 'planning-latest.json');
const archivePath = join(dir, 'planning-archive.json');
const rulesPath = join(dir, 'rules.json');
const ingestPath = join(dir, 'ingest.json');

await writeFile(rulesPath, JSON.stringify({ version: 1, rules: [] }), 'utf8');

const oldRecord = {
  id: 'planning:ealing:OLD1', reference: 'OLD1', address: '1 Old Road Ealing W5 1AA', proposal: 'Old proposal', status: 'Pending Consideration',
  validated_date: '2026-08-30', authoritative_url: 'https://example.test/old', town: 'Ealing', category: 'Planning application', out_of_borough: false,
  commons_path: '/planning/old1', place_links: [{ route:'places/ealing', label:'Ealing', relationship:'located_in', provenance:'town-classification' }]
};
await writeFile(latestPath, JSON.stringify({ generated_at:'2026-09-01T08:00:00Z', week:'24 Aug 2026', source:'test', canonical_source:'test', place_link_rules_version:1, records:[oldRecord] }), 'utf8');

function ingest(generatedAt) {
  return {
    generated_at: generatedAt, purpose:'test', source:'test', ok:true, week:'31 Aug 2026', pages_scanned:1,
    applications_discovered:1, applications_normalized:1, records_rejected:0, errors:[], records:[{
      id:'planning:ealing:NEW1', type:'planning-application', authority:'London Borough of Ealing', reference:'NEW1', address:'2 New Road Southall UB1 1AA',
      proposal:'New proposal', application_type:null, status:'Pending Consideration', decision:null, validated_date:'Sun 06 Sep 2026', decision_date:null,
      ward:null, parish:null, applicant_name:null, agent_name:null, case_officer:null, weekly_list:'31 Aug 2026', authoritative_url:'https://example.test/new',
      source:'test', parse_warnings:[], core_fields_parsed:true
    }]
  };
}

async function publish(generatedAt) {
  await writeFile(ingestPath, JSON.stringify(ingest(generatedAt)), 'utf8');
  await execFileAsync(process.execPath, [join(root, 'scripts/publish-ealing-planning-snapshot.mjs'), ingestPath, latestPath, archivePath, rulesPath], { cwd: root });
}

await publish('2026-09-08T08:00:00Z');
const firstArchiveText = await readFile(archivePath, 'utf8');
const firstArchive = JSON.parse(firstArchiveText);
assert.deepEqual(firstArchive.records.map(record => record.reference).sort(), ['NEW1', 'OLD1']);
const old = firstArchive.records.find(record => record.reference === 'OLD1');
const fresh = firstArchive.records.find(record => record.reference === 'NEW1');
assert.equal(old.first_seen_week, '24 Aug 2026');
assert.equal(old.last_seen_week, '24 Aug 2026');
assert.deepEqual(fresh.weeks_seen, ['31 Aug 2026']);
assert.equal(fresh.history.length, 1);

await publish('2026-09-08T09:00:00Z');
const secondArchiveText = await readFile(archivePath, 'utf8');
assert.equal(secondArchiveText, firstArchiveText, 'unchanged same-week rerun must not mutate durable archive');

await writeFile(rulesPath, JSON.stringify({
  version: 2,
  rules: [{
    id: 'old-site-review',
    place_route: 'places/old-site',
    label: 'Old Site',
    match: { address_contains: ['1 Old Road Ealing W5 1AA'] },
    note: 'Reviewed historical site match.'
  }]
}), 'utf8');
await publish('2026-09-08T10:00:00Z');
const rulesArchiveText = await readFile(archivePath, 'utf8');
const rulesArchive = JSON.parse(rulesArchiveText);
const reEnrichedOld = rulesArchive.records.find(record => record.reference === 'OLD1');
assert.equal(rulesArchive.place_link_rules_version, 2);
assert.ok(reEnrichedOld.place_links.some(link => link.route === 'places/old-site' && link.provenance === 'reviewed-rule'), 'retained records must receive newly reviewed place links');

await publish('2026-09-08T11:00:00Z');
const finalArchiveText = await readFile(archivePath, 'utf8');
assert.equal(finalArchiveText, rulesArchiveText, 'unchanged rerun after rule enrichment must remain idempotent');

console.log('Planning history retention, rule re-enrichment and idempotence OK.');
