#!/usr/bin/env node
// Backfilling an earlier week: publish --archive-only adds that week's
// applications to the archive and leaves the latest snapshot and the archive's
// latest week alone.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { completedWeeks } from './ingest-ealing-planning.mjs';

const dir = await mkdtemp(join(tmpdir(), 'planning-backfill-'));
const path = name => join(dir, name);
const app = (reference, extra = {}) => ({
  id: `planning:ealing:${reference.toLowerCase()}`, reference, address: `1 Test Road Southall UB1 1AA`, proposal: 'Conversion into 2 flats',
  status: 'Pending Consideration', validated_date: 'Mon 02 Nov 2026', authoritative_url: `https://pam.example/${reference}`,
  application_type: 'Full', ward: 'Southall Broadway', expected_decision_level: 'Delegated', ...extra
});
const latest = { generated_at: '2026-11-17T06:20:00Z', week: '09 Nov 2026', source: 'PAM', records: [{ reference: 'LATEST1' }] };
const existing = { reference: '100FUL', address: '1 Test Road Southall UB1 1AA', proposal: 'Conversion into 2 flats', status: 'Pending Consideration',
  validated_date: '2026-11-02', authoritative_url: 'https://pam.example/100FUL', first_seen_week: '02 Nov 2026', last_seen_week: '09 Nov 2026',
  first_seen_at: '2026-11-10T06:20:00Z', last_seen_at: '2026-11-17T06:20:00Z', weeks_seen: ['02 Nov 2026', '09 Nov 2026'], history: [] };
const archive = { archive_version: 1, generated_at: '2026-11-17T06:20:00Z', latest_week: '09 Nov 2026', source: 'PAM', records: [existing] };
const ingest = { ok: true, generated_at: '2026-11-19T16:00:00Z', week: '02 Nov 2026', source: 'PAM', applications_discovered: 2, applications_normalized: 2,
  records_rejected: 0, errors: [], records: [app('100FUL'), app('101FUL', { address: '2 Test Road Southall UB1 1AA' })] };
await writeFile(path('latest.json'), JSON.stringify(latest));
await writeFile(path('archive.json'), JSON.stringify(archive));
await writeFile(path('ingest.json'), JSON.stringify(ingest));

execFileSync(process.execPath, ['scripts/publish-ealing-planning-snapshot.mjs', '--archive-only', path('ingest.json'), path('latest.json'), path('archive.json')], { stdio: 'pipe' });
const after = JSON.parse(await readFile(path('archive.json'), 'utf8'));
assert.deepEqual(JSON.parse(await readFile(path('latest.json'), 'utf8')), latest, 'the latest snapshot is untouched');
assert.equal(after.latest_week, '09 Nov 2026', "the archive's latest week does not move back");
assert.deepEqual(after.records.map(r => r.reference).sort(), ['100FUL', '101FUL'], 'the missing application is added');
const kept = after.records.find(r => r.reference === '100FUL');
assert.equal(kept.last_seen_week, '09 Nov 2026', 'an earlier week does not move last_seen_week back');
assert.equal(kept.ward, 'Southall Broadway', 'an existing record gains the details-tab fields');
assert.equal(after.records.find(r => r.reference === '101FUL').first_seen_week, '02 Nov 2026');

// Weeks offered for backfilling: completed ones, newest first.
const weeks = completedWeeks([{ label: '16 Nov 2026', value: 'a' }, { label: '02 Nov 2026', value: 'b' }, { label: '09 Nov 2026', value: 'c' }, { label: 'All', value: '' }],
  new Date('2026-11-19T12:00:00Z'));
assert.deepEqual(weeks.map(w => w.label), ['09 Nov 2026', '02 Nov 2026'], 'the current week is not complete');

console.log('planning backfill tests passed');
