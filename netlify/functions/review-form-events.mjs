import { enqueueReview } from '../lib/review-queue.mjs';
import { newStatusToken, sendSubmissionReceipt, statusTokenHash } from '../lib/contributor-notifications.mjs';

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);
const validStatusToken = value => /^[A-Za-z0-9_-]{24,256}$/.test(text(value, 256));

async function queueItemContribution(data, statusToken) {
  return enqueueReview({
    kind: 'item-contribution',
    source: 'Civic Commons contribution form',
    dedupeKey: `item-contribution|${text(data['thread-id'], 1000)}|${text(data.body, 12000)}|${text(data.email, 320)}`,
    provenance: 'Submitted through the Civic Commons “Add to this story” form. Private contact details remain inside the review queue and are never public by default.',
    payload: {
      title: text(data['item-title'], 500), body: text(data.body, 12000), itemId: text(data['item-id'], 1000),
      threadId: text(data['thread-id'], 1000), commonsPermalink: text(data['commons-permalink'], 2048),
      originalUrl: text(data['original-url'], 2048), relatedUrl: text(data['related-url'], 2048), contributionType: text(data['contribution-type'], 120)
    },
    private: {
      displayName: text(data.name, 300), email: text(data.email, 320),
      moderationContext: `Publication consent: ${text(data['publication-consent'], 40) || 'not recorded'}`,
      statusTokenHash: statusTokenHash(statusToken)
    }
  });
}

async function queueSourceSubmission(data, statusToken) {
  return enqueueReview({
    kind: 'source-submission', source: 'Civic Commons source submission form',
    dedupeKey: `source-submission|${text(data['source-url'], 2048)}|${text(data['source-name'], 500)}|${text(data.email, 320)}`,
    provenance: 'Submitted through the public Civic Commons “Submit a source” form for human review.',
    payload: { title: text(data['source-name'], 500), body: text(data.notes, 12000), url: text(data['source-url'], 2048), area: text(data.area, 180), noticeType: text(data['source-type'], 180) },
    private: { email: text(data.email, 320), statusTokenHash: statusTokenHash(statusToken) }
  });
}

function identifyReviewKind(data) {
  const explicit = text(data['review-kind'], 120);
  if (explicit === 'item-contribution' || explicit === 'source-submission') return explicit;
  if (data['thread-id'] || data['contribution-type'] || data['item-id']) return 'item-contribution';
  if (data['source-url'] || data['source-name'] || data['source-type']) return 'source-submission';
  return null;
}

export default {
  async formSubmitted(event) {
    const data = event?.data && typeof event.data === 'object' ? event.data : {};
    if (text(data['bot-field'], 40)) return;
    const kind = identifyReviewKind(data);
    const supplied = text(data['status-token'], 256);
    const statusToken = validStatusToken(supplied) ? supplied : newStatusToken();
    let result = null;

    if (kind === 'item-contribution') result = await queueItemContribution(data, statusToken);
    else if (kind === 'source-submission') result = await queueSourceSubmission(data, statusToken);
    else {
      console.warn('Verified Civic Commons form submission could not be routed to the review queue', { fields: Object.keys(data).filter(key => key !== 'email') });
      return;
    }

    // Also try on deduplicated event deliveries/resubmissions. A successful
    // receipt is idempotently marked; a failed send releases its claim, so the
    // next verified delivery can retry it rather than silently losing mail.
    if (result.record?.private?.email) {
      const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://commons.southallstories.uk';
      const receipt = await sendSubmissionReceipt(result.record, { token: statusToken, origin: new URL(origin).origin });
      if (receipt.reason === 'send-failed') throw new Error('Contributor receipt email could not be delivered');
    }
  }
};
