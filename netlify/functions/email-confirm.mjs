import { confirmationKey, store, subscriptionKey, tokenHash } from '../lib/email-alerts.mjs';

const CONFIRMATION_TTL_MS = 48 * 60 * 60 * 1000;

function page(title, body) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Civic Commons</title><style>body{margin:0;background:#f6f4ee;color:#18221d;font-family:system-ui,sans-serif;line-height:1.55}.card{width:min(680px,calc(100% - 32px));margin:10vh auto;background:#fffdf8;border:1px solid #d9d8cf;border-radius:14px;padding:28px}h1{font-family:Georgia,serif;font-size:2.4rem;line-height:1;margin-top:0}a{color:#1f5b42;font-weight:700}button{border:0;border-radius:8px;background:#1f5b42;color:#fff;padding:12px 18px;font:inherit;font-weight:800;cursor:pointer}</style></head><body><main class="card"><h1>${title}</h1>${body}<p><a href="/#following">Return to your Civic Commons follows →</a></p></main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function lookup(token) {
  if (!token || !/^[A-Za-z0-9_-]{20,}$/.test(token)) return { error: page('Confirmation link invalid', '<p>This confirmation link is missing or malformed.</p>') };
  const blobs = store();
  const hash = tokenHash(token);
  const pointerKey = confirmationKey(hash);
  const pointer = await blobs.get(pointerKey, { type: 'json', consistency: 'strong' });
  if (!pointer?.subscriptionId) return { error: page('Already confirmed or expired', '<p>This confirmation link is no longer active. If you still want alerts, submit the email form again.</p>') };
  const createdAt = Date.parse(pointer.createdAt || 0);
  if (!createdAt || Date.now() - createdAt > CONFIRMATION_TTL_MS) return { error: page('Confirmation link expired', '<p>Confirmation links last for 48 hours. Submit the email form again to request a fresh one.</p>') };
  const key = subscriptionKey(pointer.subscriptionId);
  const subscription = await blobs.get(key, { type: 'json', consistency: 'strong' });
  if (!subscription) return { error: page('Subscription unavailable', '<p>We could not find this alert subscription.</p>') };
  return { blobs, pointerKey, key, subscription };
}

export default async request => {
  const url = new URL(request.url);
  const token = request.method === 'POST'
    ? String((await request.formData()).get('token') || '')
    : url.searchParams.get('token');
  const result = await lookup(token);
  if (result.error) return result.error;

  if (request.method === 'GET') {
    return page('Confirm email alerts', `<p>Confirm that you want Civic Commons to email future updates matching this follow set.</p><form method="post" action="/.netlify/functions/email-confirm"><input type="hidden" name="token" value="${token}"><button type="submit">Confirm email alerts</button></form><p><small>Opening this page does not activate alerts. You must press the button above.</small></p>`);
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { blobs, pointerKey, key, subscription } = result;
  if (subscription.status !== 'active') {
    const now = new Date().toISOString();
    await blobs.setJSON(key, {
      ...subscription,
      status: 'active',
      confirmedAt: now,
      lastCheckedAt: now,
      lastSentAt: null,
      seenGuids: []
    });
  }
  await blobs.delete(pointerKey);

  return page('Email alerts confirmed', '<p>Done. You’ll receive future Civic Commons items and approved updates that match these follows.</p><p>Confirmation starts the clock now, so we won’t dump the existing timeline into your inbox.</p>');
};
