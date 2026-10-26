import { LAST_RUN_KEY, SNAPSHOT_KEY, SNAPSHOT_MAX_AGE_MS } from './feed-snapshot.mjs';

// Operator alerts for the feed pipeline. The snapshot and source states make
// failures visible on the site; these make them reach someone. Checked hourly by
// the feed-health-alert scheduled function.
export const ALERT_STATE_KEY = 'alerts/state';
export const SOURCE_FAILING_ALERT_MS = 24 * 60 * 60 * 1000;
export const REMIND_AFTER_MS = 24 * 60 * 60 * 1000;
// A source whose address returns 404 or 410 has usually been moved or removed by
// its publisher, which no retry fixes, so it is reported after a couple of hours
// and named as such.
export const SOURCE_MOVED_ALERT_MS = 2 * 60 * 60 * 1000;
const FAILED = new Set(['unavailable', 'ingestion-failed']);
const MOVED = /\b(?:404|410)\s*(?:Not Found|Gone)\b|\bHTTP\s*(?:404|410)\b/i;

const timeOf = value => { const t = Date.parse(value || ''); return Number.isFinite(t) ? t : null; };
const hours = ms => `${Math.round(ms / (60 * 60 * 1000))} h`;
const minutes = ms => `${Math.round(ms / 60000)} min`;

// Problems, each with a stable key so repeated checks can tell new from ongoing.
export function feedProblems({ snapshot, lastRun, now = Date.now() }) {
  const problems = [];
  const generated = timeOf(snapshot?.generatedAt);
  if (!snapshot || generated == null) {
    problems.push({ key: 'snapshot:missing', text: 'No feed snapshot exists, so every feed request is built live from upstream sources.' });
  } else if (now - generated > SNAPSHOT_MAX_AGE_MS) {
    problems.push({ key: 'snapshot:stale', text: `The feed snapshot is ${minutes(now - generated)} old (limit ${minutes(SNAPSHOT_MAX_AGE_MS)}), so feed requests are being built live. The ingest has not completed since ${snapshot.generatedAt}.` });
  }
  if (lastRun?.finishedAt && lastRun.status && lastRun.status !== 'ok') {
    problems.push({ key: `ingest:${lastRun.status}`, text: `The last ingest run (${lastRun.finishedAt}) ended with status "${lastRun.status}"${lastRun.error ? `: ${lastRun.error}` : ''}.` });
  }
  for (const entry of Array.isArray(snapshot?.health) ? snapshot.health : []) {
    const since = timeOf(entry?.failingSince);
    const moved = MOVED.test(String(entry?.error || ''));
    if (!FAILED.has(entry?.state) || since == null || now - since < (moved ? SOURCE_MOVED_ALERT_MS : SOURCE_FAILING_ALERT_MS)) continue;
    const detail = `${hours(now - since)} (since ${entry.failingSince}; ${entry.consecutiveFailures || '?'} failed runs)${entry.error ? `: ${String(entry.error).slice(0, 200)}` : ''}.`;
    problems.push({
      key: `source:${entry.id}`,
      text: moved
        ? `${entry.name || entry.id}: feed address not found, so the publisher has probably moved or removed it and the adapter needs updating. Failing for ${detail}`
        : `${entry.name || entry.id} has been ${entry.state} for ${detail}`
    });
  }
  return problems;
}

// Sends when the set of problems changes (something new, or something resolved),
// and reminds once a day while problems persist. Never silent about a change.
export function planAlert(problems, previous = null, now = Date.now()) {
  const keys = problems.map(problem => problem.key).sort();
  const before = Array.isArray(previous?.keys) ? previous.keys : [];
  const added = problems.filter(problem => !before.includes(problem.key));
  const resolved = before.filter(key => !keys.includes(key));
  const lastSent = timeOf(previous?.sentAt);
  const remind = keys.length > 0 && !added.length && !resolved.length && (lastSent == null || now - lastSent >= REMIND_AFTER_MS);
  const send = added.length > 0 || resolved.length > 0 || remind;
  const nextState = { version: 1, checkedAt: new Date(now).toISOString(), keys, sentAt: send ? new Date(now).toISOString() : previous?.sentAt || null };
  if (!send) return { send: false, nextState };

  const subject = keys.length
    ? `Civic Commons feed: ${keys.length} problem${keys.length === 1 ? '' : 's'}${added.length ? ` (${added.length} new)` : remind ? ' (daily reminder)' : ''}`
    : 'Civic Commons feed: all problems resolved';
  const lines = [];
  if (added.length) lines.push('New:', ...added.map(problem => `- ${problem.text}`), '');
  const ongoing = problems.filter(problem => !added.includes(problem));
  if (ongoing.length) lines.push(remind ? 'Still open:' : 'Ongoing:', ...ongoing.map(problem => `- ${problem.text}`), '');
  if (resolved.length) lines.push('Resolved:', ...resolved.map(key => `- ${key}`), '');
  return { send: true, subject, text: lines.join('\n').trim(), nextState };
}

export async function readAlertInputs(blobs) {
  const [snapshot, lastRun, previous] = await Promise.all([
    blobs.get(SNAPSHOT_KEY, { type: 'json' }),
    blobs.get(LAST_RUN_KEY, { type: 'json' }),
    blobs.get(ALERT_STATE_KEY, { type: 'json' })
  ]);
  return { snapshot, lastRun, previous };
}
