import { enqueueReview } from '../lib/review-queue.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const text = (value, max = 4000) => String(value ?? '').trim().slice(0, max);

function extractSubmission(body = {}) {
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : (body.data && typeof body.data === 'object' ? body.data : {});
  const formName = text(payload.form_name || payload.formName || data['form-name'] || body.form_name, 120);
  const submissionId = text(payload.id || payload.submission_id || body.id, 180);
  return { formName, submissionId, data };
}

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid payload' }, 400); }

  const { formName, submissionId, data } = extractSubmission(body);
  if (text(data['bot-field'], 40)) return json({ ok: true, ignored: 'honeypot' });

  if (formName === 'item-contribution') {
    const result = await enqueueReview({
      kind: 'item-contribution',
      source: 'Civic Commons contribution form',
      dedupeKey: submissionId ? `netlify-submission|${submissionId}` : `item-contribution|${data['thread-id']}|${data.body}|${data.email}`,
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
    return json({ ok: true, queued: result.created, id: result.record.id });
  }

  if (formName === 'submit-source') {
    const result = await enqueueReview({
      kind: 'source-submission',
      source: 'Civic Commons source submission form',
      dedupeKey: submissionId ? `netlify-submission|${submissionId}` : `source-submission|${data['source-url']}|${data['source-name']}`,
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
    return json({ ok: true, queued: result.created, id: result.record.id });
  }

  return json({ ok: true, ignored: formName || 'unknown form' });
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: 'ip',
    windowSize: 60,
    windowLimit: 60
  }
};
