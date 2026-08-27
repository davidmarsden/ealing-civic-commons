import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'civic-commons-email-alerts';
export const MAX_TARGETS_PER_TYPE = 50;
export const MAX_TARGET_LENGTH = 512;
export const FOLLOW_TYPES = ['items', 'sources', 'towns', 'topics'];

export const store = () => getStore(STORE_NAME);
export const subscriptionKey = id => `subscription/${id}`;
export const confirmationKey = hash => `token/confirm/${hash}`;
export const unsubscribeKey = hash => `token/unsubscribe/${hash}`;

export const tokenHash = token => createHash('sha256').update(String(token)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export const newSubscriptionId = () => randomUUID();

export function cleanEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function cleanFollowEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id ?? '').trim();
  if (!id || id.length > MAX_TARGET_LENGTH || /[\u0000-\u001f\u007f]/.test(id)) return null;
  const label = String(entry.label ?? id).trim().slice(0, 180) || id;
  return { id, label };
}

export function cleanFollows(input) {
  const follows = { items: [], sources: [], towns: [], topics: [] };
  if (!input || typeof input !== 'object') return follows;

  for (const type of FOLLOW_TYPES) {
    const entries = Array.isArray(input[type]) ? input[type] : [];
    if (entries.length > MAX_TARGETS_PER_TYPE) {
      throw new Error(`Too many ${type} follows. The email alert limit is ${MAX_TARGETS_PER_TYPE} per type.`);
    }
    for (const raw of entries) {
      const entry = cleanFollowEntry(raw);
      if (!entry) continue;
      if (!follows[type].some(candidate => candidate.id === entry.id)) follows[type].push(entry);
    }
  }
  return follows;
}

export function followCount(follows) {
  return FOLLOW_TYPES.reduce((total, type) => total + (follows[type]?.length || 0), 0);
}

export function personalFeedUrl(origin, follows) {
  const url = new URL('/.netlify/functions/personal-feed', origin);
  const params = { items: 'item', sources: 'source', towns: 'town', topics: 'topic' };
  for (const type of FOLLOW_TYPES) {
    for (const entry of follows[type] || []) url.searchParams.append(params[type], entry.id);
  }
  return url.href;
}

export function followSummary(follows) {
  const labels = { items: 'Stories', sources: 'Sources', towns: 'Places', topics: 'Topics' };
  return FOLLOW_TYPES
    .filter(type => follows[type]?.length)
    .map(type => `${labels[type]}: ${follows[type].map(entry => entry.label).join(', ')}`)
    .join('\n');
}

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendMail({ to, subject, text, html }) {
  if (!mailConfigured()) throw new Error('Email delivery is not configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      text,
      html
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Email provider returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  return response.json().catch(() => ({}));
}

export function htmlEscape(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function publicOrigin(requestUrl) {
  const envUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (envUrl) {
    try { return new URL(envUrl).origin; } catch { /* use request origin */ }
  }
  return new URL(requestUrl).origin;
}
