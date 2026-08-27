import { store, subscriptionKey, tokenHash, unsubscribeKey } from '../lib/email-alerts.mjs';

function page(title, body) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Civic Commons</title><style>body{margin:0;background:#f6f4ee;color:#18221d;font-family:system-ui,sans-serif;line-height:1.55}.card{width:min(680px,calc(100% - 32px));margin:10vh auto;background:#fffdf8;border:1px solid #d9d8cf;border-radius:14px;padding:28px}h1{font-family:Georgia,serif;font-size:2.4rem;line-height:1;margin-top:0}a{color:#1f5b42;font-weight:700}</style></head><body><main class="card"><h1>${title}</h1>${body}<p><a href="/">Return to Civic Commons →</a></p></main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default async request => {
  const token = new URL(request.url).searchParams.get('token');
  if (!token || !/^[A-Za-z0-9_-]{20,}$/.test(token)) return page('Unsubscribe link invalid', '<p>This unsubscribe link is missing or malformed.</p>');

  const blobs = store();
  const hash = tokenHash(token);
  const pointer = await blobs.get(unsubscribeKey(hash), { type: 'json', consistency: 'strong' });
  if (!pointer?.subscriptionId) return page('Already unsubscribed', '<p>This email-alert subscription is no longer active.</p>');

  const key = subscriptionKey(pointer.subscriptionId);
  const subscription = await blobs.get(key, { type: 'json', consistency: 'strong' });
  if (subscription) {
    await blobs.setJSON(key, {
      ...subscription,
      status: 'unsubscribed',
      unsubscribedAt: new Date().toISOString()
    });
  }
  await blobs.delete(unsubscribeKey(hash));
  return page('Email alerts stopped', '<p>You have been unsubscribed from this Civic Commons alert feed. No account remains to manage.</p>');
};
