import { getDeployStore, getStore } from '@netlify/blobs';

export const STORE_NAME = 'civic-commons-public-contributions';

const cleanText = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const cleanUrl = value => {
  const raw = cleanText(value, 2048);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

export const store = () => Netlify.context?.deploy?.context === 'production'
  ? getStore(STORE_NAME, { consistency: 'strong' })
  : getDeployStore(STORE_NAME);

export const contributionKey = id => `contribution/${cleanText(id, 160)}`;

export function contributionIdForReview(reviewId) {
  return `contrib-${cleanText(reviewId, 120).replace(/[^A-Za-z0-9_-]/g, '')}`;
}

export function publicContributionFromReview(review) {
  if (!review?.id || review.kind !== 'item-contribution') throw new Error('Only item contributions can be promoted');
  if (review.status !== 'accepted') throw new Error('Contribution must be accepted before publication');
  if (!review.payload?.threadId || !review.payload?.body) throw new Error('Accepted contribution is missing its civic thread or body');

  const publishedAt = cleanText(review.review?.decidedAt, 80) || cleanText(review.updatedAt, 80) || new Date().toISOString();
  return {
    version: 1,
    id: contributionIdForReview(review.id),
    reviewId: cleanText(review.id, 120),
    status: 'published',
    threadId: cleanText(review.payload.threadId, 1000),
    itemId: cleanText(review.payload.itemId, 1000),
    type: cleanText(review.payload.contributionType, 120) || 'Comment / context',
    body: cleanText(review.payload.body, 12000),
    relatedUrl: cleanUrl(review.payload.relatedUrl),
    displayName: cleanText(review.private?.displayName, 300),
    submittedAt: cleanText(review.createdAt, 80),
    publishedAt,
    provenance: `Submitted to Civic Commons and published after human review. Review reference: ${cleanText(review.id, 120)}.`
  };
}

export async function publishAcceptedContribution(review) {
  const contribution = publicContributionFromReview(review);
  const blobs = store();
  const key = contributionKey(contribution.id);
  const existing = await blobs.get(key, { type: 'json' }).catch(() => null);
  if (existing?.id === contribution.id) return { contribution: existing, created: false };
  await blobs.setJSON(key, contribution);
  return { contribution, created: true };
}

export async function listPublishedContributions({ threadId = null, limit = 500 } = {}) {
  const blobs = store();
  const listed = await blobs.list({ prefix: 'contribution/' });
  const records = await Promise.all(listed.blobs.map(blob => blobs.get(blob.key, { type: 'json' }).catch(() => null)));
  return records
    .filter(record => record?.status === 'published' && record.id && record.threadId && record.body)
    .filter(record => !threadId || record.threadId === threadId)
    .sort((a, b) => Date.parse(a.publishedAt || a.submittedAt || 0) - Date.parse(b.publishedAt || b.submittedAt || 0))
    .slice(0, Math.max(1, Math.min(Number(limit) || 500, 1000)));
}
