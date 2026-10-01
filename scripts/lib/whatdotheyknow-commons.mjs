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
