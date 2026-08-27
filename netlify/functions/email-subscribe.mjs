import {
  cleanEmail,
  cleanFollows,
  confirmationKey,
  followCount,
  followSummary,
  htmlEscape,
  mailConfigured,
  newSubscriptionId,
  newToken,
  publicOrigin,
  sendMail,
  store,
  subscriptionKey,
  tokenHash,
  unsubscribeKey
} from './email-alerts-lib.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('origin');
  if (origin && origin !== requestUrl.origin) return json({ error: 'Cross-site subscription requests are not accepted.' }, 403);

  if (!mailConfigured()) {
    return json({ error: 'Email alerts are not configured on this deployment yet.' }, 503);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request body.' }, 400); }
  if (body?.website) return json({ ok: true, message: 'Check your inbox to confirm your alerts.' });

  const email = cleanEmail(body?.email);
  if (!email) return json({ error: 'Enter a valid email address.' }, 400);

  let follows;
  try { follows = cleanFollows(body?.follows); }
  catch (error) { return json({ error: error.message }, 400); }
  if (!followCount(follows)) return json({ error: 'Follow at least one story, source, place or topic first.' }, 400);

  const id = newSubscriptionId();
  const confirmationToken = newToken();
  const unsubscribeToken = newToken();
  const confirmationHash = tokenHash(confirmationToken);
  const unsubscribeHash = tokenHash(unsubscribeToken);
  const now = new Date().toISOString();
  const siteOrigin = publicOrigin(request.url);

  const subscription = {
    version: 1,
    id,
    email,
    status: 'pending',
    follows,
    createdAt: now,
    confirmedAt: null,
    lastCheckedAt: null,
    lastSentAt: null,
    seenGuids: [],
    unsubscribeToken,
    unsubscribeTokenHash: unsubscribeHash
  };

  const blobs = store();
  await Promise.all([
    blobs.setJSON(subscriptionKey(id), subscription),
    blobs.setJSON(confirmationKey(confirmationHash), { subscriptionId: id, createdAt: now }),
    blobs.setJSON(unsubscribeKey(unsubscribeHash), { subscriptionId: id, createdAt: now })
  ]);

  const confirmUrl = `${siteOrigin}/.netlify/functions/email-confirm?token=${encodeURIComponent(confirmationToken)}`;
  const summary = followSummary(follows);
  const safeSummary = htmlEscape(summary).replace(/\n/g, '<br>');

  try {
    await sendMail({
      to: email,
      subject: 'Confirm your Civic Commons email alerts',
      text: `Confirm your Civic Commons email alerts:\n\n${confirmUrl}\n\nYou asked to follow:\n${summary}\n\nNo account is being created. Alerts are chronological and contain no open or click tracking.`,
      html: `<h1>Confirm your Civic Commons alerts</h1><p>Click the link below to start receiving new civic information that matches your follows.</p><p><a href="${htmlEscape(confirmUrl)}">Confirm email alerts</a></p><p><strong>You asked to follow:</strong><br>${safeSummary}</p><p>No account is being created. Alerts are chronological and contain no open or click tracking.</p>`
    });
  } catch (error) {
    console.error('Confirmation email failed', error);
    return json({ error: 'We could not send the confirmation email. Please try again later.' }, 502);
  }

  return json({ ok: true, message: 'Check your inbox to confirm your alerts.' });
};

export const config = {
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: 'ip',
    windowSize: 60,
    windowLimit: 5
  }
};
