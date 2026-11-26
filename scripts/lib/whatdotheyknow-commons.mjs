import { DEFAULT_BASE_URL, STATE_LABELS, canonicalWdtkUrl, stateFromSummary } from './whatdotheyknow.mjs';

export function whatDoTheyKnowCommonsItem(request) {
  if (!request?.sourceId) throw new Error('WDTK request needs sourceId');
  const evidence = [];
  for (const attachment of request.attachments || []) evidence.push({ type: 'attachment', name: attachment.name || null, url: attachment.url || null, contentType: attachment.contentType || null, size: attachment.size || null });
  return {
    id: `whatdotheyknow:${request.authority?.urlName || 'authority'}:${request.sourceId}`,
    sourceId: 'whatdotheyknow',
    source: 'WhatDoTheyKnow',
    sourceClass: 'information-request',
    sourceHomepage: request.authority?.url || 'https://www.whatdotheyknow.com',
    title: request.title || 'Information request',
    url: request.url,
    canonicalUrl: request.url,
    summary: request.summary || '',
    publishedAt: request.createdAt || request.updatedAt || null,
    towns: [],
    topics: [],
    officialCategories: ['FOI / EIR request'],
    topicProvenance: null,
    derived: false,
    derivedFrom: null,
    mutableSource: {
      sourceType: request.sourceType,
      upstreamId: request.sourceId,
      authority: request.authority || null,
      status: request.status || null,
      upstreamUpdatedAt: request.updatedAt || null,
      correspondence: request.correspondence || [],
      attachments: evidence,
      tags: request.tags || [],
    },
  };
}

// Items archived before the relay-host and status fixes carry chat-dev links and
// status "standalone". Returns a corrected copy, or null when nothing needs changing.
export function repairWhatDoTheyKnowItem(item, { baseUrl = DEFAULT_BASE_URL } = {}) {
  if (item?.sourceId !== 'whatdotheyknow' || !item.mutableSource) return null;
  const url = canonicalWdtkUrl(item.url, baseUrl), canonicalUrl = canonicalWdtkUrl(item.canonicalUrl, baseUrl);
  const status = item.mutableSource.status;
  const fixedStatus = !status || status === 'standalone' || !(status in STATE_LABELS) ? (stateFromSummary(item.summary) || null) : status;
  if (url === item.url && canonicalUrl === item.canonicalUrl && fixedStatus === status) return null;
  return { ...item, url, canonicalUrl, mutableSource: { ...item.mutableSource, status: fixedStatus } };
}
