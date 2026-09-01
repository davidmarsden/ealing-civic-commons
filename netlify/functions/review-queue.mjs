import { timingSafeEqual } from 'node:crypto';
import { decideReview, enqueueReview, getReview, listReviews, REVIEW_STATUSES } from '../lib/review-queue.mjs';
import { fetchEalingPublicNoticeCandidates } from '../lib/public-notice-candidates.mjs';
import { reconcileContributionPublication } from '../lib/public-contributions.mjs';
import { getArchivedItem, stableItemKey, validItemKey } from '../lib/civic-items.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow'
  }
});

function configuredToken() {
  return String(Netlify.env.get('REVIEW_ADMIN_TOKEN') || '');
}

function authorised(request) {
  const expected = configuredToken();
  if (!expected) return false;
  const header = String(request.headers.get('authorization') || '');
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function parseBody(request) {
  try { return await request.json(); }
  catch { return null; }
}

function promotionPayload(record, result) {
  return {
    type: 'public-contribution',
    id: result.contribution?.id || `contrib-${record.id}`,
    published: result.status === 'accepted' && result.action === 'published',
    action: result.action,
    created: result.created ?? false,
    removed: result.removed ?? false,
    authoritativeStatus: result.status
  };
}

async function withCanonicalTarget(record) {
  if (record?.kind !== 'item-contribution') return record;
  const itemId = String(record.payload?.itemId || '').trim();
  if (!itemId) return { ...record, canonicalTarget: null };
  const key = stableItemKey(itemId);
  if (!validItemKey(key)) return { ...record, canonicalTarget: null };
  try {
    const archived = await getArchivedItem(key, { consistency: 'strong' });
    if (!archived?.item || archived.item.id !== itemId) return { ...record, canonicalTarget: null };
    return {
      ...record,
      canonicalTarget: {
        key,
        threadId: `civic-item:${key}`,
        title: archived.item.title || 'Untitled civic item',
        originalUrl: archived.item.url || null,
        commonsPath: `/items/${key}`,
        source: archived.item.source || null
      }
    };
  } catch (error) {
    console.error('Canonical review target lookup failed', { reviewId: record.id, error });
    return { ...record, canonicalTarget: null };
  }
}

export default async request => {
  if (!configuredToken()) {
    return json({ error: 'Review queue is not configured. Set REVIEW_ADMIN_TOKEN on this deployment.' }, 503);
  }
  if (!authorised(request)) return json({ error: 'Unauthorised' }, 401);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const requested = String(url.searchParams.get('status') || '').trim();
    const status = REVIEW_STATUSES.includes(requested) ? requested : null;
    const records = await listReviews({ status, limit: 300 });
    return json({ ok: true, records: await Promise.all(records.map(withCanonicalTarget)) });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await parseBody(request);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request body' }, 400);

  if (body.action === 'decision') {
    if (!['accepted', 'rejected', 'needs-info'].includes(body.status)) return json({ error: 'Invalid decision status' }, 400);
    try {
      const record = await decideReview(body.id, {
        status: body.status,
        reviewer: body.reviewer,
        note: body.note
      });
      if (!record) return json({ error: 'Review item not found' }, 404);

      let promotion = null;
      if (record.kind === 'item-contribution') {
        try {
          const result = await reconcileContributionPublication(record.id);
          promotion = promotionPayload(record, result);
        } catch (error) {
          console.error('Contribution publication reconciliation failed', { reviewId: record.id, error });
          return json({
            error: `Review decision saved, but public contribution state could not be reconciled: ${error.message || error}`,
            record: await withCanonicalTarget(record),
            promotion: { type: 'public-contribution', published: null }
          }, 500);
        }
      }

      return json({ ok: true, record: await withCanonicalTarget(record), promotion });
    } catch (error) {
      return json({ error: error.message || 'Decision failed' }, 400);
    }
  }

  if (body.action === 'reconcile-publication') {
    try {
      const record = await getReview(body.id);
      if (!record) return json({ error: 'Review item not found' }, 404);
      if (record.kind !== 'item-contribution') return json({ error: 'Only item contributions have a publication state to reconcile' }, 400);
      const result = await reconcileContributionPublication(record.id);
      const refreshed = await getReview(record.id);
      if (!refreshed) return json({ error: 'Review item not found after reconciliation' }, 404);
      return json({ ok: true, record: await withCanonicalTarget(refreshed), promotion: promotionPayload(refreshed, result) });
    } catch (error) {
      console.error('Contribution publication retry failed', { reviewId: body.id, error });
      return json({ error: `Public contribution could not be reconciled: ${error.message || error}` }, 500);
    }
  }

  if (body.action === 'enqueue') {
    const result = await enqueueReview(body.review || {});
    return json({ ok: true, created: result.created, record: await withCanonicalTarget(result.record) }, result.created ? 201 : 200);
  }

  if (body.action === 'import-public-notices') {
    let candidates;
    try {
      candidates = await fetchEalingPublicNoticeCandidates({ limit: body.limit || 16 });
    } catch (error) {
      console.error('Public Notice Portal import failed', error);
      return json({ error: `Public Notice Portal import failed: ${error.message || error}` }, 502);
    }
    const results = await Promise.all(candidates.map(candidate => enqueueReview(candidate).catch(error => ({ error }))));
    return json({
      ok: true,
      discovered: candidates.length,
      created: results.filter(result => result?.created).length,
      alreadyQueued: results.filter(result => result && !result.error && !result.created).length,
      failed: results.filter(result => result?.error).length
    });
  }

  return json({ error: 'Unknown action' }, 400);
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: 'ip',
    windowSize: 60,
    windowLimit: 120
  }
};
