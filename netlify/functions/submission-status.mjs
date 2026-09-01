import { getReviewByStatusToken } from '../lib/review-queue.mjs';
import { listPublishedContributions } from '../lib/public-contributions.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers:{ 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-robots-tag':'noindex, nofollow' } });

function publicStatus(record, contribution) {
  const title = record.payload?.title || (record.kind === 'source-submission' ? 'Source suggestion' : 'Civic Commons submission');
  const commonsPath = (() => { try { return new URL(record.payload?.commonsPermalink || '').pathname || null; } catch { return null; } })();
  let state = 'received';
  let label = 'Awaiting review';
  if (record.status === 'needs-info') { state = 'needs-info'; label = 'More information needed'; }
  else if (record.status === 'rejected') { state = 'not-published'; label = 'Not published'; }
  else if (record.status === 'accepted' && contribution) { state = 'published'; label = 'Published after review'; }
  else if (record.status === 'accepted') { state = 'accepted'; label = 'Accepted for further review'; }
  return {
    version:1, reference:record.id, kind:record.kind, title, state, label,
    submittedAt:record.createdAt, updatedAt:record.updatedAt, commonsPath,
    publishedPath: contribution && commonsPath ? `${commonsPath}#contribution-${contribution.id}` : null,
    publishedAt:contribution?.publishedAt || null
  };
}

export default async request => {
  if (request.method !== 'GET') return json({ error:'Method not allowed' }, 405);
  const token = String(new URL(request.url).searchParams.get('token') || '').trim();
  if (!token || token.length > 256) return json({ error:'Status link is invalid.' }, 400);
  const record = await getReviewByStatusToken(token);
  if (!record) return json({ error:'Submission status not found.' }, 404);
  let contribution = null;
  if (record.kind === 'item-contribution' && record.payload?.threadId) {
    contribution = (await listPublishedContributions({ threadId:record.payload.threadId, limit:250 })).find(entry => entry.reviewId === record.id) || null;
  }
  return json(publicStatus(record, contribution));
};
