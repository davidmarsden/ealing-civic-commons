import { enqueueReview, stableReviewId } from '../lib/review-queue.mjs';

const ALLOWED_ORIGINS = new Set([
  'https://chat-dev.ealing.civiccommons.co.uk',
  'https://ealing.civiccommons.co.uk'
]);

const REASONS = new Set([
  'abuse-or-harassment',
  'hate-or-discrimination',
  'threats-or-safety',
  'spam-or-manipulation',
  'private-information',
  'other'
]);

function cors(request) {
  const origin = String(request.headers.get('origin') || '');
  return ALLOWED_ORIGINS.has(origin) ? origin : 'https://ealing.civiccommons.co.uk';
}

function json(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': cors(request),
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'vary': 'Origin'
    }
  });
}

function clean(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function validChatPostUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'chat-dev.ealing.civiccommons.co.uk' &&
      (url.searchParams.has('id') || url.pathname === '/');
  } catch {
    return false;
  }
}

export default async request => {
  if (request.method === 'OPTIONS') return json(request, { ok: true });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);

  let body;
  try { body = await request.json(); }
  catch { return json(request, { error: 'Invalid report.' }, 400); }

  const postUrl = clean(body?.postUrl, 2048);
  const postId = clean(body?.postId, 120);
  const postAuthor = clean(body?.postAuthor, 300);
  const reason = clean(body?.reason, 120);
  const details = clean(body?.details, 2000);
  const excerpt = clean(body?.excerpt, 1000);
  const reportedBy = clean(body?.reportedBy, 300);

  if (!validChatPostUrl(postUrl) || !postId) {
    return json(request, { error: 'The reported post could not be identified.' }, 400);
  }
  if (!REASONS.has(reason)) {
    return json(request, { error: 'Choose a report reason.' }, 400);
  }

  const id = stableReviewId([
    'commons-chat-report',
    postId,
    reason,
    reportedBy || 'anonymous',
    details
  ].join('|'));

  const result = await enqueueReview({
    id,
    kind: 'commons-chat-report',
    source: 'Commons Chat report',
    provenance: 'Submitted from the Commons Chat reporting control for moderation review.',
    payload: {
      title: `Reported Commons Chat post by ${postAuthor || 'unknown author'}`,
      body: details || 'No additional details supplied.',
      url: postUrl,
      relatedUrl: postUrl,
      postId,
      postAuthor,
      reportReason: reason
    },
    private: {
      moderationContext: [
        reportedBy ? `Reporter: ${reportedBy}` : 'Reporter: not signed in',
        excerpt ? `Post excerpt: ${excerpt}` : ''
      ].filter(Boolean).join('\n')
    }
  });

  return json(request, {
    ok: true,
    reference: result.record.id,
    created: result.created
  }, result.created ? 201 : 200);
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: 'ip',
    windowSize: 60,
    windowLimit: 10
  }
};
