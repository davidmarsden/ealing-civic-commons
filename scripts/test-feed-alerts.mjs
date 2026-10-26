#!/usr/bin/env node
// Feed health alerts: what counts as a problem, when an email goes out, and that a
// failed send is retried rather than recorded as delivered.
import assert from 'node:assert/strict';
import { ALERT_STATE_KEY, feedProblems, planAlert } from '../netlify/lib/feed-alerts.mjs';
import { LAST_RUN_KEY, SNAPSHOT_KEY } from '../netlify/lib/feed-snapshot.mjs';

globalThis.Netlify = { context: { deploy: { context: 'production' } } };
const { runFeedHealthCheck } = await import('../netlify/functions/feed-health-alert.mjs');

const HOUR = 60 * 60 * 1000;
const now = Date.parse('2026-10-15T12:00:00Z');
const iso = ms => new Date(ms).toISOString();
const source = (id, state, failingFor) => ({ id, name: id.toUpperCase(), state, ok: state === 'current', failingSince: failingFor == null ? null : iso(now - failingFor), consecutiveFailures: 4, error: 'HTTP 403' });

// Problems.
assert.deepEqual(feedProblems({ snapshot: null, now }).map(p => p.key), ['snapshot:missing']);
const fresh = { generatedAt: iso(now - 10 * 60 * 1000), items: [], health: [source('ok', 'current'), source('brief', 'unavailable', 2 * HOUR), source('long', 'unavailable', 30 * HOUR), source('broken', 'ingestion-failed', 25 * HOUR), source('empty', 'no-new-records')] };
assert.deepEqual(feedProblems({ snapshot: fresh, now }).map(p => p.key), ['source:long', 'source:broken'], 'only sources failing for over 24 h');
assert.match(feedProblems({ snapshot: fresh, now })[0].text, /LONG has been unavailable for 30 h/);
// A feed address that returns 404 or 410 has moved: reported after 2 h, and said so.
const moved = { ...source('culture', 'unavailable', 3 * HOUR), error: 'collection_fetch_failed:event:404 Not Found: https://ealingculture.org/wp-json/wp/v2/event' };
const movedProblems = feedProblems({ snapshot: { ...fresh, health: [moved, { ...source('gone', 'ingestion-failed', 3 * HOUR), error: 'HTTP 410' }, { ...source('fresh404', 'unavailable', HOUR), error: '404 Not Found' }] }, now });
assert.deepEqual(movedProblems.map(p => p.key), ['source:culture', 'source:gone'], 'moved feeds alert after 2 h, not 24 h');
assert.match(movedProblems[0].text, /^CULTURE: feed address not found, so the publisher has probably moved or removed it/);
assert.match(movedProblems[0].text, /Failing for 3 h .*404 Not Found/);
assert.deepEqual(feedProblems({ snapshot: { ...fresh, health: [{ ...source('id404', 'unavailable', 3 * HOUR), error: 'HTTP 503 for item 404' }] }, now }), [], 'a 404 that is not a status is not a move');
assert.deepEqual(feedProblems({ snapshot: { ...fresh, generatedAt: iso(now - 2 * HOUR), health: [] }, now }).map(p => p.key), ['snapshot:stale']);
assert.deepEqual(feedProblems({ snapshot: { ...fresh, health: [] }, lastRun: { status: 'failed', finishedAt: iso(now - HOUR), error: 'boom' }, now }).map(p => p.key), ['ingest:failed']);
assert.deepEqual(feedProblems({ snapshot: { ...fresh, health: [] }, lastRun: { status: 'running', startedAt: iso(now) }, now }), [], 'a run in progress is not a failure');

// Sending decisions.
const problems = feedProblems({ snapshot: fresh, now });
const first = planAlert(problems, null, now);
assert.ok(first.send && /2 problems \(2 new\)/.test(first.subject) && /New:/.test(first.text));
assert.equal(planAlert(problems, first.nextState, now + HOUR).send, false, 'unchanged problems are not re-sent within a day');
const reminder = planAlert(problems, first.nextState, now + 25 * HOUR);
assert.ok(reminder.send && /daily reminder/.test(reminder.subject) && /Still open:/.test(reminder.text));
const partly = planAlert(problems.slice(0, 1), first.nextState, now + HOUR);
assert.ok(partly.send && /Resolved:\n- source:broken/.test(partly.text), 'a resolved problem is reported');
const clear = planAlert([], partly.nextState, now + 2 * HOUR);
assert.ok(clear.send && /all problems resolved/.test(clear.subject));
assert.equal(planAlert([], clear.nextState, now + 30 * HOUR).send, false, 'no reminders when all is well');

// The scheduled check, with a stub store and mailer.
const blobs = (() => { const data = new Map([[SNAPSHOT_KEY, fresh], [LAST_RUN_KEY, { status: 'ok', finishedAt: iso(now) }]]); return { data, get: async key => data.get(key) ?? null, setJSON: async (key, value) => { data.set(key, value); } }; })();
const sent = [];
const ok = async mail => { sent.push(mail); };
assert.equal((await runFeedHealthCheck({ blobs, send: ok, recipients: [], canSend: true, now })).reason, 'not-configured');
assert.equal(blobs.data.get(ALERT_STATE_KEY), undefined, 'nothing recorded while unconfigured');
await assert.rejects(runFeedHealthCheck({ blobs, send: async () => { throw new Error('provider down'); }, recipients: ['ops@example.org'], canSend: true, now }), /provider down/);
assert.equal(blobs.data.get(ALERT_STATE_KEY), undefined, 'a failed send is not recorded as delivered');
const delivered = await runFeedHealthCheck({ blobs, send: ok, recipients: ['ops@example.org', 'b@example.org'], canSend: true, now });
assert.ok(delivered.sent && sent.length === 2 && sent[0].to === 'ops@example.org');
assert.deepEqual(blobs.data.get(ALERT_STATE_KEY).keys, ['source:broken', 'source:long']);
assert.equal((await runFeedHealthCheck({ blobs, send: ok, recipients: ['ops@example.org'], canSend: true, now: now + 30 * 60 * 1000 })).reason, 'unchanged');
assert.equal(sent.length, 2);

console.log('Feed alerts: problems, change detection, reminders, resolution and retry on failed send OK.');
