import { timingSafeEqual } from 'node:crypto';
import { decideReview, enqueueReview, listReviews, REVIEW_STATUSES } from '../lib/review-queue.mjs';
import { fetchEalingPublicNoticeCandidates } from '../lib/public-notice-candidates.mjs';

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
    return json({ ok: true, records });
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
      return json({ ok: true, record });
    } catch (error) {
      return json({ error: error.message || 'Decision failed' }, 400);
    }
  }

  if (body.action === 'enqueue') {
    const result = await enqueueReview(body.review || {});
    return json({ ok: true, created: result.created, record: result.record }, result.created ? 201 : 200);
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
