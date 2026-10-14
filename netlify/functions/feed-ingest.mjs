import { randomUUID } from 'node:crypto';
import { buildCombinedFeed } from './combined-feed.mjs';
import { runArchive } from './item-archive.mjs';
import { acquireIngestLock, applySourceStates, readSourceState, releaseIngestLock, store, writeSnapshot, writeSourceState } from '../lib/feed-snapshot.mjs';

// Background ingest: builds the combined feed once from every upstream source,
// records each source's state, writes the snapshot that combined-feed serves, then
// archives. Triggered by the scheduled item-archive function every 15 minutes.
// The URL is public, so a lock plus a minimum interval decide whether a call does
// any work; duplicate or premature calls exit immediately.
export async function runIngest({ origin, blobs = store({ consistency: 'strong' }), build = buildCombinedFeed, archive = runArchive, now = () => Date.now() } = {}) {
  const runId = randomUUID();
  const lock = await acquireIngestLock(blobs, { runId, now: now() });
  if (!lock.acquired) {
    console.log(`Feed ingest skipped: ${lock.reason}${lock.since ? ` (running since ${lock.since})` : ''}${lock.lastStartedAt ? ` (last started ${lock.lastStartedAt})` : ''}`);
    return { skipped: lock.reason };
  }
  const started = now();
  const summary = { status: 'failed' };
  try {
    const response = await build(new Request(new URL('/.netlify/functions/combined-feed', origin)));
    if (!response?.ok) throw new Error(`live feed build returned HTTP ${response?.status || 'unknown'}`);
    const live = await response.json();
    const buildMs = now() - started;

    const previous = await readSourceState(blobs).catch(() => undefined);
    const { feed, state } = applySourceStates(live, previous, new Date(now()).toISOString());
    await writeSnapshot(blobs, { ...feed, ingest: { runId, buildMs } });
    await writeSourceState(blobs, state);

    const slowest = [...feed.health].filter(entry => Number.isFinite(entry.durationMs)).sort((a, b) => b.durationMs - a.durationMs).slice(0, 5).map(entry => `${entry.id} ${entry.durationMs}ms`);
    const problems = feed.health.filter(entry => entry.state === 'unavailable' || entry.state === 'ingestion-failed').map(entry => `${entry.id}=${entry.state}`);
    console.log(`Feed snapshot written: ${feed.items.length} items; states ${JSON.stringify(feed.sourceStates)}; build ${buildMs}ms; slowest ${slowest.join(', ')}${problems.length ? `; problems ${problems.join(', ')}` : ''}`);

    const archived = await archive(live);
    Object.assign(summary, { status: archived?.error ? 'archive-failed' : 'ok', buildMs, items: feed.items.length, sourceStates: feed.sourceStates, archived: archived?.stored ?? null, totalMs: now() - started });
    return summary;
  } catch (error) {
    console.error('Feed ingest failed', error);
    summary.error = String(error?.message || error);
    return summary;
  } finally {
    await releaseIngestLock(blobs, { runId, summary }).catch(error => console.error('Feed ingest lock release failed', error));
  }
}

export default async (request, context) => {
  if (request.method !== 'POST') return;
  const origin = context?.site?.url || process.env.URL || new URL(request.url).origin;
  await runIngest({ origin });
};

export const config = { background: true };
