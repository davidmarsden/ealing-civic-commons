import { getDeployStore, getStore } from '@netlify/blobs';
import { getArchivedItem, stableItemKey, validItemKey } from './civic-items.mjs';
import { getReview } from './review-queue.mjs';

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

export function publicationStoreScope() {
  // Netlify's runtime context is authoritative when available. CONTEXT is a
  // documented runtime/build fallback and protects production Functions from
  // accidentally falling through to a deploy-scoped Blob store.
  const runtimeContext = String(Netlify.context?.deploy?.context || '').trim();
  const envContext = String(process.env.CONTEXT || '').trim();
  return runtimeContext === 'production' || envContext === 'production' ? 'global' : 'deploy';
}

export const store = () => publicationStoreScope() === 'global'
  ? getStore(STORE_NAME, { consistency: 'strong' })
  : getDeployStore(STORE_NAME);

export const contributionKey = id => `contribution/${cleanText(id, 160)}`;

export function contributionIdForReview(reviewId) {
  return `contrib-${cleanText(reviewId, 120).replace(/[^A-Za-z0-9_-]/g, '')}`;
}

async function canonicalItemForReview(review) {
  const itemId = cleanText(review?.payload?.itemId, 1000);
  if (!itemId) throw new Error('Accepted contribution is missing its civic item ID');

  const key = stableItemKey(itemId);
  if (!validItemKey(key)) throw new Error('Accepted contribution has an invalid civic item key');

  const expectedThread = `civic-item:${key}`;
  if (cleanText(review?.payload?.threadId, 1000) !== expectedThread) {
    throw new Error('Submitted civic thread does not match the canonical item ID');
  }

  const permalink = cleanUrl(review?.payload?.commonsPermalink);
  if (!permalink) throw new Error('Accepted contribution is missing its Civic Commons permalink');
  const permalinkUrl = new URL(permalink);
  if (permalinkUrl.pathname.replace(/\/+$/, '') !== `/items/${key}`) {
    throw new Error('Submitted Civic Commons permalink does not match the canonical civic item');
  }

  const archived = await getArchivedItem(key, { consistency: 'strong' });
  if (!archived?.item || archived.item.id !== itemId) {
    throw new Error('Canonical civic item could not be verified in the persistent archive');
  }

  // The item ID, stable thread and Commons permalink are the security binding.
  // Title and original source URL are display hints populated by the browser
  // and may legitimately differ from the archived canonical representation.
  // Public output always uses the archived canonical item rather than trusting
  // those submitted display fields.
  return { key, threadId: expectedThread, item: archived.item };
}

export function publicContributionFromReview(review, canonical) {
  if (!review?.id || review.kind !== 'item-contribution') throw new Error('Only item contributions can be promoted');
  if (review.status !== 'accepted') throw new Error('Contribution must be accepted before publication');
  if (!canonical?.threadId || !review.payload?.body) throw new Error('Accepted contribution is missing its civic thread or body');

  const publishedAt = cleanText(review.review?.decidedAt, 80) || cleanText(review.updatedAt, 80) || new Date().toISOString();
  return {
    version: 1,
    id: contributionIdForReview(review.id),
    reviewId: cleanText(review.id, 120),
    status: 'published',
    threadId: canonical.threadId,
    itemId: cleanText(canonical.item.id, 1000),
    type: cleanText(review.payload.contributionType, 120) || 'Comment / context',
    body: cleanText(review.payload.body, 12000),
    relatedUrl: cleanUrl(review.payload.relatedUrl),
    displayName: cleanText(review.private?.displayName, 300),
    submittedAt: cleanText(review.createdAt, 80),
    publishedAt,
    provenance: `Submitted to Civic Commons and published after human review. Review reference: ${cleanText(review.id, 120)}.`
  };
}

function samePublishedContribution(actual, expected) {
  return actual?.status === 'published'
    && actual.id === expected.id
    && actual.reviewId === expected.reviewId
    && actual.threadId === expected.threadId
    && actual.itemId === expected.itemId
    && actual.body === expected.body
    && actual.publishedAt === expected.publishedAt;
}

export async function publishAcceptedContribution(review) {
  const canonical = await canonicalItemForReview(review);
  const contribution = publicContributionFromReview(review, canonical);
  const blobs = store();
  const key = contributionKey(contribution.id);
  const existing = await blobs.get(key, { type: 'json' });

  if (!samePublishedContribution(existing, contribution)) {
    await blobs.setJSON(key, contribution);
  }

  // A successful Blob write is not enough to claim publication. Verify the
  // exact public representation through the same store selection used by the
  // public reader. In production the store is strongly consistent.
  const persisted = await blobs.get(key, { type: 'json' });
  if (!samePublishedContribution(persisted, contribution)) {
    throw new Error(`Published contribution could not be read back from the ${publicationStoreScope()} Blob store`);
  }

  return {
    contribution: persisted,
    created: !existing?.id,
    verified: true,
    storeScope: publicationStoreScope()
  };
}

export async function withdrawContributionForReview(reviewId) {
  const id = contributionIdForReview(reviewId);
  const blobs = store();
  // Blob deletion is idempotent. Delete the deterministic key directly so a
  // transient read failure can never be mistaken for a successful withdrawal.
  await blobs.delete(contributionKey(id));
  return { removed: true, id, storeScope: publicationStoreScope() };
}

export async function reconcileContributionPublication(reviewId, { attempts = 4 } = {}) {
  const maxAttempts = Math.max(1, Math.min(Number(attempts) || 4, 8));
  let lastAction = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const before = await getReview(reviewId);
    if (!before) throw new Error('Review item not found during publication reconciliation');
    if (before.kind !== 'item-contribution') return { status: before.status, action: 'none', contribution: null };

    if (before.status === 'accepted') {
      const result = await publishAcceptedContribution(before);
      lastAction = {
        status: before.status,
        action: 'published',
        contribution: result.contribution,
        created: result.created,
        verified: result.verified,
        storeScope: result.storeScope
      };
    } else {
      const result = await withdrawContributionForReview(before.id);
      lastAction = {
        status: before.status,
        action: 'withdrawn',
        contribution: null,
        removed: result.removed,
        storeScope: result.storeScope
      };
    }

    // Decision events are authoritative. If another reviewer changed the
    // status while the Blob mutation was in flight, loop and reconcile again.
    const after = await getReview(reviewId);
    if (!after) throw new Error('Review item disappeared during publication reconciliation');
    if (after.status === before.status && after.review?.decidedAt === before.review?.decidedAt) return lastAction;
  }

  throw new Error('Contribution publication could not converge on the authoritative review status');
}

export async function listPublishedContributions({ threadId = null, limit = 500 } = {}) {
  const blobs = store();
  const listed = await blobs.list({ prefix: 'contribution/' });
  const records = await Promise.all(listed.blobs.map(blob => blobs.get(blob.key, { type: 'json' }).catch(() => null)));
  const max = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const chronological = records
    .filter(record => record?.status === 'published' && record.id && record.threadId && record.body)
    .filter(record => !threadId || record.threadId === threadId)
    .sort((a, b) => Date.parse(a.publishedAt || a.submittedAt || 0) - Date.parse(b.publishedAt || b.submittedAt || 0));

  // Keep the newest bounded window, then leave that window chronological for
  // item-page rendering and downstream RSS sorting.
  return chronological.slice(-max);
}
