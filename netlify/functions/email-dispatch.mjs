import { XMLParser } from 'fast-xml-parser';
import {
  htmlEscape,
  mailConfigured,
  personalFeedUrl,
  publicOrigin,
  sendMail,
  store
} from './email-alerts-lib.mjs';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];
const textValue = value => typeof value === 'object' && value !== null ? value['#text'] ?? '' : value ?? '';
const MAX_SEEN_GUIDS = 300;
const MAX_ENTRIES_PER_EMAIL = 25;

function plain(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function normaliseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function parseFeed(xml) {
  const parsed = parser.parse(xml);
  const items = arr(parsed?.rss?.channel?.item);
  return items.map(item => ({
    guid: plain(textValue(item.guid) || item.link || item.title),
    title: plain(textValue(item.title) || 'Civic Commons update'),
    link: plain(textValue(item.link)),
    description: plain(textValue(item.description)),
    publishedAt: normaliseDate(textValue(item.pubDate))
  })).filter(item => item.guid && item.link);
}

async function fetchPersonalFeed(origin, follows) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(personalFeedUrl(origin, follows), {
      signal: controller.signal,
      headers: { accept: 'application/rss+xml, application/xml;q=0.9' }
    });
    if (!response.ok) throw new Error(`Personal RSS returned HTTP ${response.status}`);
    return parseFeed(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

function newEntriesFor(subscription, items) {
  const seen = new Set(subscription.seenGuids || []);
  if (!subscription.lastSentAt) {
    const confirmedAt = Date.parse(subscription.confirmedAt || subscription.createdAt || 0);
    return items.filter(item => item.publishedAt && Date.parse(item.publishedAt) > confirmedAt);
  }
  return items.filter(item => !seen.has(item.guid));
}

function digestText(entries, unsubscribeUrl) {
  const lines = ['New Civic Commons updates matching your follows:', ''];
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.title}`);
    if (entry.description) lines.push(entry.description.slice(0, 700));
    lines.push(entry.link, '');
  });
  lines.push('Chronological alerts. No engagement ranking. No open or click tracking.', '', `Unsubscribe: ${unsubscribeUrl}`);
  return lines.join('\n');
}

function digestHtml(entries, unsubscribeUrl) {
  const cards = entries.map(entry => `<article style="margin:0 0 24px"><h2 style="font-size:20px;margin:0 0 8px"><a href="${htmlEscape(entry.link)}" style="color:#1f5b42">${htmlEscape(entry.title)}</a></h2>${entry.description ? `<p style="margin:0;color:#46514a">${htmlEscape(entry.description.slice(0, 700))}</p>` : ''}</article>`).join('');
  return `<div style="font-family:system-ui,-apple-system,sans-serif;color:#18221d;line-height:1.5;max-width:680px"><h1 style="font-family:Georgia,serif">Civic Commons updates</h1><p>New chronological civic information matching your follows.</p>${cards}<hr style="border:0;border-top:1px solid #d9d8cf"><p style="font-size:13px;color:#68726c">No engagement ranking. No open or click tracking. <a href="${htmlEscape(unsubscribeUrl)}">Unsubscribe from these alerts</a>.</p></div>`;
}

async function processSubscription(blobs, key, subscription, origin) {
  if (subscription?.status !== 'active' || !subscription.email || !subscription.unsubscribeToken) return { skipped: true };

  let items;
  try {
    items = await fetchPersonalFeed(origin, subscription.follows);
  } catch (error) {
    console.error(`Email alert feed failed for ${subscription.id}`, error);
    return { failed: true };
  }

  const now = new Date().toISOString();
  const firstDelivery = !subscription.lastSentAt;
  const candidates = newEntriesFor(subscription, items).slice(0, MAX_ENTRIES_PER_EMAIL);
  const currentGuids = items.map(item => item.guid);

  if (!candidates.length) {
    const seededSeen = firstDelivery
      ? currentGuids.slice(0, MAX_SEEN_GUIDS)
      : subscription.seenGuids || [];
    await blobs.setJSON(key, { ...subscription, lastCheckedAt: now, seenGuids: seededSeen });
    return { sent: 0 };
  }

  const unsubscribeUrl = `${origin}/.netlify/functions/email-unsubscribe?token=${encodeURIComponent(subscription.unsubscribeToken)}`;
  await sendMail({
    to: subscription.email,
    subject: candidates.length === 1 ? `Civic Commons: ${candidates[0].title}` : `Civic Commons: ${candidates.length} new updates`,
    text: digestText(candidates, unsubscribeUrl),
    html: digestHtml(candidates, unsubscribeUrl)
  });

  const seen = firstDelivery
    ? currentGuids.slice(0, MAX_SEEN_GUIDS)
    : [...new Set([...(subscription.seenGuids || []), ...candidates.map(item => item.guid)])].slice(-MAX_SEEN_GUIDS);
  await blobs.setJSON(key, { ...subscription, lastCheckedAt: now, lastSentAt: now, seenGuids: seen });
  return { sent: candidates.length };
}

export default async request => {
  if (!mailConfigured()) {
    console.log('Email dispatcher skipped: RESEND_API_KEY / EMAIL_FROM not configured');
    return;
  }

  const origin = publicOrigin(request.url);
  const blobs = store();
  const listing = await blobs.list({ prefix: 'subscription/' });
  let sent = 0;
  let failed = 0;

  for (const blob of listing.blobs) {
    const subscription = await blobs.get(blob.key, { type: 'json', consistency: 'strong' });
    try {
      const result = await processSubscription(blobs, blob.key, subscription, origin);
      sent += result?.sent || 0;
      if (result?.failed) failed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Email alert dispatch failed for ${blob.key}`, error);
    }
  }

  console.log(`Civic Commons email dispatch complete: ${sent} entries sent; ${failed} subscriptions failed`);
};

export const config = {
  schedule: '*/15 * * * *'
};
