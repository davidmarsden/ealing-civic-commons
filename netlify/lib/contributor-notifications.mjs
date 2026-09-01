import { randomBytes } from 'node:crypto';
import { cleanEmail, htmlEscape, mailConfigured, sendMail } from './email-alerts.mjs';
import { claimNotification, hashStatusToken } from './review-queue.mjs';

export const newStatusToken = () => randomBytes(32).toString('base64url');
export const statusTokenHash = token => hashStatusToken(token);

function statusUrl(origin, token) {
  const url = new URL('/submission-status.html', origin);
  url.searchParams.set('token', token);
  return url.href;
}

function storyTitle(review) {
  return review?.payload?.title || (review?.kind === 'source-submission' ? 'your source suggestion' : 'your Civic Commons contribution');
}

function itemUrl(review, origin) {
  const raw = review?.payload?.commonsPermalink;
  if (!raw) return null;
  try { return new URL(raw, origin).href; } catch { return null; }
}

async function sendOnce(review, event, mail) {
  const email = cleanEmail(review?.private?.email);
  if (!email || !mailConfigured()) return { sent: false, reason: email ? 'mail-not-configured' : 'no-email' };
  if (!(await claimNotification(review.id, event))) return { sent: false, reason: 'already-sent' };
  try {
    await sendMail({ to: email, ...mail });
    return { sent: true };
  } catch (error) {
    console.error('Contributor notification failed', { reviewId: review.id, event, error });
    return { sent: false, reason: 'send-failed' };
  }
}

export async function sendSubmissionReceipt(review, { token, origin }) {
  const url = statusUrl(origin, token);
  const title = storyTitle(review);
  const text = `We received your Civic Commons submission.\n\n${title}\n\nIt is waiting for human review. Nothing is published automatically.\n\nCheck its status: ${url}\n`;
  const html = `<p>We received your Civic Commons submission.</p><p><strong>${htmlEscape(title)}</strong></p><p>It is waiting for human review. Nothing is published automatically.</p><p><a href="${htmlEscape(url)}">Check your submission status</a></p>`;
  return sendOnce(review, 'receipt', { subject: 'Civic Commons: submission received', text, html });
}

export async function sendDecisionNotification(review, { promotion = null, origin }) {
  if (review.kind !== 'item-contribution') return { sent: false, reason: 'unsupported-kind' };
  const decision = review.history?.at(-1);
  const title = storyTitle(review);

  if (review.status === 'accepted' && promotion?.published && promotion?.id) {
    const target = itemUrl(review, origin) || origin;
    const url = `${target}#contribution-${encodeURIComponent(promotion.id)}`;
    return sendOnce(review, `published-${promotion.id}`, {
      subject: 'Civic Commons: your contribution was published',
      text: `Your contribution to “${title}” has been published after review.\n\nView it: ${url}\n`,
      html: `<p>Your contribution to <strong>${htmlEscape(title)}</strong> has been published after review.</p><p><a href="${htmlEscape(url)}">View the published contribution</a></p>`
    });
  }

  if (!decision?.id || !['needs-info', 'rejected'].includes(review.status)) return { sent: false, reason: 'no-notifiable-change' };
  const needsInfo = review.status === 'needs-info';
  return sendOnce(review, `decision-${decision.id}`, {
    subject: needsInfo ? 'Civic Commons: more information is needed' : 'Civic Commons: contribution not published',
    text: needsInfo
      ? `Your contribution to “${title}” has been reviewed and needs more information before it can be published.\n\nPlease return to the Civic Commons story if you want to submit additional context.\n`
      : `Your contribution to “${title}” has been reviewed and was not published.\n`,
    html: needsInfo
      ? `<p>Your contribution to <strong>${htmlEscape(title)}</strong> has been reviewed and needs more information before it can be published.</p><p>Please return to the Civic Commons story if you want to submit additional context.</p>`
      : `<p>Your contribution to <strong>${htmlEscape(title)}</strong> has been reviewed and was not published.</p>`
  });
}
