import { XMLParser } from 'fast-xml-parser';

export const DEFAULT_BASE_URL = 'https://www.whatdotheyknow.com';
export const EALING_AUTHORITY_SLUG = 'ealing_borough_council';

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => value == null ? null : typeof value === 'object' ? (value['#text'] ?? null) : String(value);
const clean = value => text(value)?.replace(/\s+/g, ' ').trim() || null;
const iso = value => { if (!value) return null; const d = new Date(value); return Number.isNaN(d.valueOf()) ? null : d.toISOString(); };
const stripHtml = value => clean(String(text(value) || '').replace(/<[^>]*>/g, ' ').replace(/&lt;[^&]*?&gt;/g, ' '));

export function requestSlug(url = '') {
  const match = String(url).match(/\/request\/([^/?#]+)/);
  return match?.[1] || null;
}

// Alaveteli request states, keyed by the labels WDTK prints in listings and feeds.
export const STATE_LABELS = {
  waiting_classification: 'Awaiting classification',
  waiting_response: 'Awaiting response',
  waiting_response_overdue: 'Delayed',
  waiting_response_very_overdue: 'Long overdue',
  waiting_clarification: 'Awaiting clarification',
  internal_review: 'Awaiting internal review',
  successful: 'Successful',
  partially_successful: 'Partially successful',
  not_held: 'Information not held',
  rejected: 'Refused',
  user_withdrawn: 'Withdrawn by the requester',
  gone_postal: 'Handled by post',
  error_message: 'Delivery error',
  requires_admin: 'Unusual response',
  attention_requested: 'Reported for administrator attention',
  vexatious: 'Considered vexatious',
  not_foi: 'Not an FOI request',
};
const LABEL_STATES = Object.fromEntries(Object.entries(STATE_LABELS).map(([code, label]) => [label.toLowerCase(), code]));
// Longest first, so "Partially successful" wins over "Successful".
const LABELS_BY_LENGTH = Object.values(STATE_LABELS).sort((a, b) => b.length - a.length);

export function stateFromLabel(label) {
  return LABEL_STATES[String(label || '').replace(/\s+/g, ' ').replace(/\.$/, '').trim().toLowerCase()] || null;
}

// Recover a state from listing text such as "Response by X to Y on 26 November 2026 . Awaiting classification ...".
export function stateFromSummary(summary) {
  const textValue = String(summary || '');
  for (const label of LABELS_BY_LENGTH) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|\\d{4}\\s*\\.\\s*)${escaped}\\b`, 'i').test(textValue)) return stateFromLabel(label);
  }
  return null;
}

function atomStatus(content) {
  const raw = String(text(content) || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  // The listing icon carries two classes, e.g. "icon-standalone icon_waiting_classification"; the second is the state.
  const icon = [...raw.matchAll(/icon_([a-z_]+)/gi)].map(m => m[1].toLowerCase()).find(code => code !== 'standalone' && code in STATE_LABELS);
  if (icon) return icon;
  const strong = raw.match(/<strong[^>]*>\s*([^<]+?)\s*<\/strong>/i)?.[1];
  return stateFromLabel(strong);
}

// The relay serves WDTK's feed with its own host in every link; point links back at WDTK.
export function canonicalWdtkUrl(value, baseUrl = DEFAULT_BASE_URL) {
  if (!value) return value ?? null;
  try {
    const url = new URL(value, baseUrl), base = new URL(baseUrl);
    if (url.host !== base.host && /^\/(request|request_event|body|user)\//.test(url.pathname)) { url.protocol = base.protocol; url.host = base.host; }
    return url.toString();
  } catch { return value; }
}

export function parseAuthorityAtom(atomText, { baseUrl = DEFAULT_BASE_URL, authoritySlug = EALING_AUTHORITY_SLUG } = {}) {
  const doc = xml.parse(atomText);
  const feed = doc.feed || doc.rss?.channel;
  if (!feed) throw new Error('WhatDoTheyKnow feed payload was not Atom/RSS');
  return array(feed.entry || feed.item).map(entry => {
    const links = array(entry.link);
    const href = links.map(link => typeof link === 'string' ? link : link?.['@_href']).find(Boolean);
    const eventUrl = href ? canonicalWdtkUrl(href, baseUrl) : null;
    const raw = String(text(entry.content || entry.summary || entry.description) || '');
    const requestHref = raw.match(/https?:\/\/[^/"'&<>\s]+\/request\/[^&"'<>\s]+/i)?.[0]?.replace(/&amp;.*$/,'') || raw.match(/href=(?:&quot;|["'])([^"'&]*\/request\/[^"'&<]+)/i)?.[1];
    const url = requestHref ? canonicalWdtkUrl(requestHref, baseUrl) : eventUrl;
    const slug = requestSlug(url) || clean(entry.id)?.match(/InfoRequestEvent\/(\d+)/)?.[1];
    return {
      source: 'whatdotheyknow', sourceType: 'foi-request', sourceId: slug,
      url, title: clean(entry.title), summary: stripHtml(entry.content || entry.summary || entry.description),
      status: atomStatus(entry.content || entry.summary || entry.description),
      createdAt: iso(clean(entry.published || entry.pubDate)), updatedAt: iso(clean(entry.updated || entry.published || entry.pubDate)),
      authority: { name: 'Ealing Borough Council', urlName: authoritySlug, url: `${baseUrl}/body/${authoritySlug}` },
      correspondence: [], attachments: [], tags: [],
    };
  }).filter(item => item.sourceId && item.url && item.title);
}

function attachmentFrom(value, baseUrl) {
  if (!value || typeof value !== 'object') return null;
  const url = value.url || value.download_url || value.file_url || value.web_url;
  const name = value.filename || value.name || value.display_name;
  if (!url && !name) return null;
  return { name: name || null, url: url ? new URL(url, baseUrl).toString() : null, contentType: value.content_type || value.contentType || null, size: value.size || null };
}

export function normalizeRequestJson(payload, { baseUrl = DEFAULT_BASE_URL, authoritySlug = EALING_AUTHORITY_SLUG, fallback = {} } = {}) {
  const request = payload?.info_request || payload?.request || payload;
  if (!request || typeof request !== 'object') throw new Error('WhatDoTheyKnow request JSON was not an object');
  const rawUrl = request.url || request.web_url || request.request_url || fallback.url;
  const slug = request.url_title || request.slug || requestSlug(rawUrl) || fallback.sourceId;
  if (!slug) throw new Error('WhatDoTheyKnow request JSON has no stable request identity');
  const url = rawUrl ? new URL(rawUrl, baseUrl).toString() : `${baseUrl}/request/${slug}`;
  const authorityRaw = request.public_body || request.authority || payload?.public_body || {};
  const authorityName = authorityRaw.name || request.public_body_name || fallback.authority?.name || 'Ealing Borough Council';
  const authorityUrlName = authorityRaw.url_name || authorityRaw.slug || fallback.authority?.urlName || authoritySlug;
  const messages = array(request.incoming_messages || request.messages || request.correspondence || payload?.incoming_messages || payload?.messages);
  const correspondence = messages.map((message, index) => ({ id: message.id ?? message.message_id ?? index + 1, sentAt: iso(message.sent_at || message.created_at || message.date), from: message.from_name || message.sender_name || message.from || null, subject: message.subject || null, direction: message.direction || (message.incoming === true ? 'incoming' : message.incoming === false ? 'outgoing' : null) }));
  const attachments = [];
  for (const candidate of array(request.attachments || payload?.attachments)) { const parsed = attachmentFrom(candidate, baseUrl); if (parsed) attachments.push(parsed); }
  for (const message of messages) for (const candidate of array(message.attachments)) { const parsed = attachmentFrom(candidate, baseUrl); if (parsed) attachments.push(parsed); }
  const uniqueAttachments = [...new Map(attachments.map(item => [`${item.url || ''}|${item.name || ''}`, item])).values()];
  return { source: 'whatdotheyknow', sourceType: 'foi-request', sourceId: slug, url, title: request.title || request.name || fallback.title || slug.replaceAll('_', ' '), authority: { name: authorityName, urlName: authorityUrlName, url: `${baseUrl}/body/${authorityUrlName}` }, status: request.described_state || request.state || request.status || payload?.described_state || null, createdAt: iso(request.created_at || request.created || fallback.createdAt), updatedAt: iso(request.updated_at || request.updated || fallback.updatedAt), summary: request.summary || request.description || fallback.summary || null, correspondence, attachments: uniqueAttachments, tags: array(request.tags || payload?.tags).map(tag => typeof tag === 'string' ? tag : tag?.name).filter(Boolean) };
}
