import { createHash, randomUUID } from 'node:crypto';
import { getDeployStore, getStore } from '@netlify/blobs';

export const STORE_NAME = 'civic-commons-review-queue';
export const REVIEW_KINDS = ['item-contribution', 'source-submission', 'evidence-suggestion', 'relationship-suggestion'];
export const REVIEW_STATUSES = ['pending', 'needs-info', 'accepted', 'rejected'];

export const store = () => Netlify.context?.deploy?.context === 'production'
  ? getStore(STORE_NAME, { consistency: 'strong' })
  : getDeployStore(STORE_NAME);
export const reviewKey = id => `review/${String(id || '').trim()}`;
export const auditKey = (id, eventId) => `audit/${String(id || '').trim()}/${eventId}`;

const cleanText = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const cleanArray = (value, max = 20) => Array.isArray(value) ? value.map(item => cleanText(item, 180)).filter(Boolean).slice(0, max) : [];

export function cleanHttpUrl(value) {
  const raw = cleanText(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function stableReviewId(seed) {
  const normalized = cleanText(seed, 4096);
  if (!normalized) return `rq-${randomUUID()}`;
  return `rq-${createHash('sha256').update(normalized).digest('hex').slice(0, 24)}`;
}

export function normalizeReview(input = {}) {
  const kind = REVIEW_KINDS.includes(input.kind) ? input.kind : 'evidence-suggestion';
  const source = cleanText(input.source || 'Civic Commons', 180) || 'Civic Commons';
  const payload = input.payload && typeof input.payload === 'object' ? input.payload : {};
  const url = cleanHttpUrl(payload.url || input.url);
  const id = cleanText(input.id, 120) || stableReviewId(input.dedupeKey || `${kind}|${source}|${url || ''}|${payload.title || payload.body || ''}`);
  const now = new Date().toISOString();

  return {
    version: 1,
    id,
    kind,
    source,
    status: REVIEW_STATUSES.includes(input.status) ? input.status : 'pending',
    createdAt: cleanText(input.createdAt, 80) || now,
    updatedAt: cleanText(input.updatedAt, 80) || now,
    provenance: cleanText(input.provenance, 1000) || `Queued for Civic Commons review from ${source}.`,
    payload: {
      title: cleanText(payload.title, 500),
      body: cleanText(payload.body, 12000),
      url,
      relatedUrl: cleanHttpUrl(payload.relatedUrl),
      itemId: cleanText(payload.itemId, 1000),
      threadId: cleanText(payload.threadId, 1000),
      commonsPermalink: cleanHttpUrl(payload.commonsPermalink),
      originalUrl: cleanHttpUrl(payload.originalUrl),
      contributionType: cleanText(payload.contributionType, 120),
      noticeType: cleanText(payload.noticeType, 120),
      area: cleanText(payload.area, 180),
      topics: cleanArray(payload.topics),
      towns: cleanArray(payload.towns),
      publisher: cleanText(payload.publisher, 300),
      publishedAt: cleanText(payload.publishedAt, 80)
    },
    private: {
      displayName: cleanText(input.private?.displayName || payload.displayName, 300),
      email: cleanText(input.private?.email || payload.email, 320),
      moderationContext: cleanText(input.private?.moderationContext, 2000)
    },
    review: {
      reviewer: cleanText(input.review?.reviewer, 180),
      note: cleanText(input.review?.note, 4000),
      decidedAt: cleanText(input.review?.decidedAt, 80)
    },
    history: Array.isArray(input.history) ? input.history.slice(-50) : []
  };
}

export async function enqueueReview(input) {
  const blobs = store();
  const candidate = normalizeReview(input);
  const existing = await blobs.get(reviewKey(candidate.id), { type: 'json' }).catch(() => null);
  if (existing?.id === candidate.id) return { record: existing, created: false };
  await blobs.setJSON(reviewKey(candidate.id), candidate);
  return { record: candidate, created: true };
}

export async function getReview(id) {
  const cleanId = cleanText(id, 120);
  if (!cleanId) return null;
  return store().get(reviewKey(cleanId), { type: 'json' }).catch(() => null);
}

export async function listReviews({ status = null, limit = 250 } = {}) {
  const blobs = store();
  const listed = await blobs.list({ prefix: 'review/' });
  const records = await Promise.all(listed.blobs.map(blob => blobs.get(blob.key, { type: 'json' }).catch(() => null)));
  return records
    .filter(record => record?.id && (!status || record.status === status))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 250, 500)));
}

export async function decideReview(id, { status, reviewer, note = '' } = {}) {
  if (!REVIEW_STATUSES.includes(status) || status === 'pending') throw new Error('Invalid review decision');
  const blobs = store();
  const current = await getReview(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const event = {
    id: randomUUID(),
    reviewId: current.id,
    at: now,
    from: current.status,
    to: status,
    reviewer: cleanText(reviewer, 180) || 'Reviewer',
    note: cleanText(note, 4000)
  };
  const updated = normalizeReview({
    ...current,
    status,
    updatedAt: now,
    review: { reviewer: event.reviewer, note: event.note, decidedAt: now },
    history: [...(Array.isArray(current.history) ? current.history : []), event].slice(-50)
  });

  await Promise.all([
    blobs.setJSON(reviewKey(current.id), updated),
    blobs.setJSON(auditKey(current.id, event.id), event)
  ]);
  return updated;
}
