import { store, subscriptionKey, tokenHash, unsubscribeKey } from '../lib/email-alerts.mjs';

function page(title, body) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Civic Commons</title><style>body{margin:0;background:#f6f4ee;color:#18221d;font-family:system-ui,sans-serif;line-height:1.55}.card{width:min(680px,calc(100% - 32px));margin:10vh auto;background:#fffdf8;border:1px solid #d9d8cf;border-radius:14px;padding:28px}h1{font-family:Georgia,serif;font-size:2.4rem;line-height:1;margin-top:0}a{color:#1f5b42;font-weight:700}button{border:0;border-radius:8px;background:#1f5b42;color:#fff;padding:12px 18px;font:inherit;font-weight:800;cursor:pointer}</style></head><body><main class="card"><h1>${title}</h1>${body}<p><a href="/">Return to Civic Commons →</a></p></main></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function lookup(token) {
  if (!token || !/^[A-Za-z0-9_-]{20,}$/.test(token)) return { error: page('Unsubscribe link invalid', '<p>This unsubscribe link is missing or malformed.</p>') };
  const blobs = store();
  const hash = tokenHash(token);
  const pointerKey = unsubscribeKey(hash);
  const pointer = await blobs.get(pointerKey, { type: 'json', consistency: 'strong' });
  if (!pointer?.subscriptionId) return { error: page('Already unsubscribed', '<p>This email-alert subscription is no longer active.</p>') };
  const key = subscriptionKey(pointer.subscriptionId);
  const subscription = await blobs.get(key, { type: 'json', consistency: 'strong' });
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
    return page('Stop email alerts?', `<p>This will stop this Civic Commons email-alert subscription.</p><form method="post" action="/.netlify/functions/email-unsubscribe"><input type="hidden" name="token" value="${token}"><button type="submit">Stop email alerts</button></form><p><small>Opening this page does not unsubscribe you. You must press the button above.</small></p>`);
  }
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { blobs, pointerKey, key, subscription } = result;
  if (subscription) {
    await blobs.setJSON(key, {
      ...subscription,
      status: 'unsubscribed',
      unsubscribedAt: new Date().toISOString()
    });
  }
  await blobs.delete(pointerKey);
  return page('Email alerts stopped', '<p>You have been unsubscribed from this Civic Commons alert feed. No account remains to manage.</p>');
};
