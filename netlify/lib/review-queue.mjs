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
export const statusTokenKey = hash => `status-token/${String(hash || '').trim()}`;
export const notificationKey = (id, event) => `notification/${String(id || '').trim()}/${String(event || '').trim()}`;

const cleanText = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const cleanArray = (value, max = 20) => Array.isArray(value) ? value.map(item => cleanText(item, 180)).filter(Boolean).slice(0, max) : [];
export const hashStatusToken = token => createHash('sha256').update(String(token || '')).digest('hex');

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
      moderationContext: cleanText(input.private?.moderationContext, 2000),
      statusTokenHash: cleanText(input.private?.statusTokenHash, 128)
    },
    review: {
      reviewer: cleanText(input.review?.reviewer, 180),
      note: cleanText(input.review?.note, 4000),
      decidedAt: cleanText(input.review?.decidedAt, 80)
    },
    history: Array.isArray(input.history) ? input.history.slice(-50) : []
  };
}

async function loadAuditEvents(blobs, id) {
  const listed = await blobs.list({ prefix: `audit/${id}/` });
  const events = await Promise.all(listed.blobs.map(blob => blobs.get(blob.key, { type: 'json' }).catch(() => null)));
  return events
    .filter(event => event?.id && REVIEW_STATUSES.includes(event.to) && event.to !== 'pending')
    .sort((a, b) => {
      const time = Date.parse(a.at || 0) - Date.parse(b.at || 0);
      return time || String(a.id).localeCompare(String(b.id));
    });
}

async function hydrateReview(blobs, record) {
  if (!record?.id) return record;
  const events = await loadAuditEvents(blobs, record.id);
  if (!events.length) return record;
  let status = 'pending';
  const history = events.map(event => {
    const hydrated = { ...event, from: status };
    status = event.to;
    return hydrated;
  });
  const last = history.at(-1);
  return normalizeReview({
    ...record,
    status,
    updatedAt: last?.at || record.updatedAt,
    review: last ? { reviewer: last.reviewer, note: last.note, decidedAt: last.at } : record.review,
    history: history.slice(-50)
  });
}

export async function enqueueReview(input) {
  const blobs = store();
  const candidate = normalizeReview(input);
  const existing = await blobs.get(reviewKey(candidate.id), { type: 'json' }).catch(() => null);
  if (existing?.id === candidate.id) return { record: await hydrateReview(blobs, existing), created: false };
  await blobs.setJSON(reviewKey(candidate.id), candidate);
  if (candidate.private.statusTokenHash) {
    await blobs.setJSON(statusTokenKey(candidate.private.statusTokenHash), { reviewId: candidate.id, createdAt: candidate.createdAt });
  }
  return { record: candidate, created: true };
}

export async function getReview(id) {
  const cleanId = cleanText(id, 120);
  if (!cleanId) return null;
  const blobs = store();
  const record = await blobs.get(reviewKey(cleanId), { type: 'json' }).catch(() => null);
  return hydrateReview(blobs, record);
}

export async function getReviewByStatusToken(token) {
  const raw = cleanText(token, 256);
  if (!raw) return null;
  const blobs = store();
  const lookup = await blobs.get(statusTokenKey(hashStatusToken(raw)), { type: 'json' }).catch(() => null);
  return lookup?.reviewId ? getReview(lookup.reviewId) : null;
}

export async function claimNotification(id, event) {
  const blobs = store();
  const key = notificationKey(id, event);
  const existing = await blobs.get(key, { type: 'json' }).catch(() => null);
  if (existing) return false;
  await blobs.setJSON(key, { reviewId: id, event, at: new Date().toISOString() });
  return true;
}

export async function listReviews({ status = null, limit = 250 } = {}) {
  const blobs = store();
  const listed = await blobs.list({ prefix: 'review/' });
  const raw = await Promise.all(listed.blobs.map(blob => blobs.get(blob.key, { type: 'json' }).catch(() => null)));
  const records = await Promise.all(raw.filter(record => record?.id).map(record => hydrateReview(blobs, record)));
  return records
    .filter(record => record?.id && (!status || record.status === status))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 250, 500)));
}

export async function decideReview(id, { status, reviewer, note = '' } = {}) {
  if (!REVIEW_STATUSES.includes(status) || status === 'pending') throw new Error('Invalid review decision');
  const blobs = store();
  const cleanId = cleanText(id, 120);
  const base = await blobs.get(reviewKey(cleanId), { type: 'json' }).catch(() => null);
  if (!base) return null;
  const now = new Date().toISOString();
  const event = {
    id: randomUUID(),
    reviewId: base.id,
    at: now,
    to: status,
    reviewer: cleanText(reviewer, 180) || 'Reviewer',
    note: cleanText(note, 4000)
  };
  await blobs.setJSON(auditKey(base.id, event.id), event);
  const updated = normalizeReview({
    ...base,
    status,
    updatedAt: now,
    review: { reviewer: event.reviewer, note: event.note, decidedAt: now }
  });
  await blobs.setJSON(reviewKey(base.id), updated);
  return hydrateReview(blobs, updated);
}
