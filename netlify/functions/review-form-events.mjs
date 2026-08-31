import { enqueueReview } from '../lib/review-queue.mjs';

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

async function queueItemContribution(data) {
  return enqueueReview({
    kind: 'item-contribution',
    source: 'Civic Commons contribution form',
    dedupeKey: `item-contribution|${text(data['thread-id'], 1000)}|${text(data.body, 12000)}|${text(data.email, 320)}`,
    provenance: 'Submitted through the Civic Commons “Add to this story” form. Private contact details remain inside the review queue and are never public by default.',
    payload: {
      title: text(data['item-title'], 500),
      body: text(data.body, 12000),
      itemId: text(data['item-id'], 1000),
      threadId: text(data['thread-id'], 1000),
      commonsPermalink: text(data['commons-permalink'], 2048),
      originalUrl: text(data['original-url'], 2048),
      relatedUrl: text(data['related-url'], 2048),
      contributionType: text(data['contribution-type'], 120)
    },
    private: {
      displayName: text(data.name, 300),
      email: text(data.email, 320),
      moderationContext: `Publication consent: ${text(data['publication-consent'], 40) || 'not recorded'}`
    }
  });
}

async function queueSourceSubmission(data) {
  return enqueueReview({
    kind: 'source-submission',
    source: 'Civic Commons source submission form',
    dedupeKey: `source-submission|${text(data['source-url'], 2048)}|${text(data['source-name'], 500)}|${text(data.email, 320)}`,
    provenance: 'Submitted through the public Civic Commons “Submit a source” form for human review.',
    payload: {
      title: text(data['source-name'], 500),
      body: text(data.notes, 12000),
      url: text(data['source-url'], 2048),
      area: text(data.area, 180),
      noticeType: text(data['source-type'], 180)
    },
    private: {
      email: text(data.email, 320)
    }
  });
}

export default {
  async formSubmitted(event) {
    const data = event?.data && typeof event.data === 'object' ? event.data : {};
    if (text(data['bot-field'], 40)) return;
    const formName = text(data['form-name'] || data.form_name, 120);

    if (formName === 'item-contribution') {
      await queueItemContribution(data);
      return;
    }

    if (formName === 'submit-source') {
      await queueSourceSubmission(data);
    }
  }
};
