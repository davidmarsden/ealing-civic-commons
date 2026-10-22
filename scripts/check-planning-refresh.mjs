#!/usr/bin/env node
// Guard for the weekly planning refresh before it merges itself: the refreshed
// snapshot must not go backwards against the base branch. The latest week must
// have records and be no older than the base's, and the durable archive must not
// lose applications. (The publish script already refuses an incomplete ingest.)
//
//   node scripts/check-planning-refresh.mjs [base-ref]   (default origin/main)
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const LATEST = 'public/data/planning-latest.json';
const ARCHIVE = 'public/data/planning-archive.json';

export function checkRefresh({ latest, archive, baseLatest, baseArchive }) {
  const problems = [];
  const weekTime = value => Date.parse(`${value} UTC`);
  if (!Array.isArray(latest?.records) || !latest.records.length) problems.push('latest snapshot has no records');
  if (!Number.isFinite(weekTime(latest?.week))) problems.push(`latest week "${latest?.week}" is not a date`);
  else if (baseLatest?.week && weekTime(latest.week) < weekTime(baseLatest.week)) problems.push(`latest week ${latest.week} is older than the base's ${baseLatest.week}`);
  if (!Array.isArray(archive?.records)) problems.push('archive has no records array');
  else if (Array.isArray(baseArchive?.records) && archive.records.length < baseArchive.records.length) problems.push(`archive shrank from ${baseArchive.records.length} to ${archive.records.length} applications`);
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const base = process.argv[2] || 'origin/main';
  const atBase = path => { try { return JSON.parse(execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })); } catch { return null; } };
  const problems = checkRefresh({
    latest: JSON.parse(await readFile(LATEST, 'utf8')),
    archive: JSON.parse(await readFile(ARCHIVE, 'utf8')),
    baseLatest: atBase(LATEST),
    baseArchive: atBase(ARCHIVE)
  });
  if (problems.length) {
    console.error(`Planning refresh refused:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Planning refresh checks passed.');
}
