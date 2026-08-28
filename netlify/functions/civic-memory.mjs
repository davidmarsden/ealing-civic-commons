const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

const PRIMARY_CITATION_DOMAINS = new Set([
  'ealing.gov.uk',
  'ealing.moderngov.co.uk',
  'data.ealing.gov.uk',
  'police.uk',
  'london.gov.uk',
  'gov.uk',
  'assets.publishing.service.gov.uk',
  'caselaw.nationalarchives.gov.uk',
  'legislation.gov.uk',
  'ons.gov.uk',
  'nhs.uk',
  'england.nhs.uk',
  'changegrowlive.org'
]);

const CITATION_PUBLISHERS = new Map([
  ['ealing.gov.uk', 'Ealing Council'],
  ['ealing.moderngov.co.uk', 'Ealing Council'],
  ['data.ealing.gov.uk', 'Ealing Council'],
  ['police.uk', 'Police.uk / Metropolitan Police'],
  ['london.gov.uk', 'Greater London Authority'],
  ['gov.uk', 'UK Government'],
  ['assets.publishing.service.gov.uk', 'UK Government'],
  ['caselaw.nationalarchives.gov.uk', 'The National Archives'],
  ['legislation.gov.uk', 'UK legislation'],
  ['ons.gov.uk', 'Office for National Statistics'],
  ['nhs.uk', 'NHS'],
  ['england.nhs.uk', 'NHS England'],
  ['changegrowlive.org', 'Change Grow Live'],
  ['andrewteale.me.uk', 'Local Elections Archive Project'],
  ['plumplot.co.uk', 'Plumplot']
]);

const EXCLUDED_RELATED_CITATION_DOMAINS = new Set([
  'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'youtube.com', 'youtu.be',
  'communitypoweredreporting.co.uk'
]);

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`,
      'access-control-allow-origin': '*'
    }
  });
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    url.search = '';
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    let path = url.pathname.replace(/\/+$/, '');
    if (!path) path = '/';
    return `${url.protocol}//${url.hostname}${path}`;
  } catch {
    return null;
  }
}

function evidenceUrlKey(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    url.protocol = 'https:';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    }
    return url.href.replace(/\/$/, '');
  } catch {
    return String(value || '');
  }
}

function domainMatches(domain, allowed) {
  if (!domain) return false;
  if (allowed.has(domain)) return true;
  return [...allowed].some(base => domain.endsWith(`.${base}`));
}

function byId(items = []) {
  return new Map(items.map(item => [item.id, item]));
}

function dateValue(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function sharedContext(exportData, postId) {
  const entityIds = new Set();
  const topicIds = new Set();
  for (const link of exportData.links || []) {
    if (link.target !== postId || link.type !== 'mentioned-in') continue;
    if (link.source.startsWith('entity:')) entityIds.add(link.source);
    if (link.source.startsWith('topic:')) topicIds.add(link.source);
  }
  return { entityIds, topicIds };
}

function mentionDocumentFrequency(exportData) {
  const postsByContext = new Map();
  for (const link of exportData.links || []) {
    if (link.type !== 'mentioned-in' || !link.target.startsWith('post:')) continue;
    if (!postsByContext.has(link.source)) postsByContext.set(link.source, new Set());
    postsByContext.get(link.source).add(link.target);
  }
  return new Map([...postsByContext].map(([id, posts]) => [id, posts.size]));
}

function contextWeight(id, frequencies, totalPosts, entitiesById) {
  const frequency = frequencies.get(id) || totalPosts;
  const specificity = Math.log((totalPosts + 1) / (frequency + 1)) + 1;
  if (id.startsWith('topic:')) return specificity * 0.45;
  const type = entitiesById.get(id)?.type;
  const typeWeight = type === 'person' ? 2.2 : type === 'place' ? 2.05 : type === 'organisation' ? 1.85 : 1.7;
  return specificity * typeWeight;
}

function contextsByPost(exportData) {
  const map = new Map();
  for (const link of exportData.links || []) {
    if (link.type !== 'mentioned-in' || !link.target.startsWith('post:')) continue;
    if (!map.has(link.target)) map.set(link.target, new Set());
    map.get(link.target).add(link.source);
  }
  return map;
}

function relatedEarlierPosts(exportData, matchedPost, entityIds, topicIds, entitiesById, frequencies) {
  const totalPosts = (exportData.posts || []).length;
  const contextByPost = contextsByPost(exportData);
  const directTargets = new Set((exportData.links || [])
    .filter(link => link.type === 'links-to' && link.source === matchedPost.id)
    .map(link => link.target));
  const matchedDate = dateValue(matchedPost.date);

  return (exportData.posts || [])
    .filter(post => post.id !== matchedPost.id && dateValue(post.date) < matchedDate)
    .map(post => {
      const candidateContext = contextByPost.get(post.id) || new Set();
      const sharedEntities = [...entityIds].filter(id => candidateContext.has(id));
      const sharedTopics = [...topicIds].filter(id => candidateContext.has(id));
      const direct = directTargets.has(post.id);
      let score = direct ? 100 : 0;
      score += sharedEntities.reduce((sum, id) => sum + contextWeight(id, frequencies, totalPosts, entitiesById), 0);
      score += sharedTopics.reduce((sum, id) => sum + contextWeight(id, frequencies, totalPosts, entitiesById), 0);
      const strongestEntity = Math.max(0, ...sharedEntities.map(id => contextWeight(id, frequencies, totalPosts, entitiesById)));
      const qualifies = direct || (sharedEntities.length >= 1 && strongestEntity >= 4.25) || (sharedEntities.length >= 2 && score >= 5.5);
      return { post, score, qualifies, direct, sharedEntityCount: sharedEntities.length };
    })
    .filter(entry => entry.qualifies)
    .sort((a, b) => Number(b.direct) - Number(a.direct) || b.score - a.score || dateValue(b.post.date) - dateValue(a.post.date))
    .slice(0, 3)
    .map(({ post, direct, sharedEntityCount }) => ({
      id: post.id,
      title: post.title,
      date: post.date,
      url: post.url,
      connection: direct ? 'linked-from-story' : `shared-context:${sharedEntityCount}`
    }));
}

function sourceView(source) {
  return {
    id: source.id,
    title: source.title,
    publisher: source.publisher,
    sourceType: source.source_type,
    date: source.publication_date || source.meeting_date || null,
    url: source.canonical_url,
    evidenceKind: 'curated-source'
  };
}

function citationView(citation, evidenceKind) {
  return {
    id: `citation:${citation.post}:${evidenceUrlKey(citation.url)}`,
    title: citation.label || citation.domain,
    publisher: CITATION_PUBLISHERS.get(citation.domain) || citation.domain,
    sourceType: evidenceKind === 'article-primary' ? 'Directly cited evidence' : 'Directly cited source',
    date: null,
    url: citation.url,
    evidenceKind
  };
}

function evidenceSourceIds(exportData, matchedPost, entityIds) {
  const ids = new Set();
  for (const source of exportData.sources || []) {
    if ((source.cited_by || []).includes(matchedPost.id)) ids.add(source.id);
  }
  for (const relationship of exportData.relationships || []) {
    if (relationship.review_status !== 'reviewed') continue;
    if (!entityIds.has(relationship.from) || !entityIds.has(relationship.to)) continue;
    for (const evidence of relationship.evidence || []) {
      if (evidence?.id?.startsWith('source:')) ids.add(evidence.id);
    }
  }
  return ids;
}

function directCitations(exportData, matchedPost) {
  return (exportData.citations || []).filter(citation => citation.post === matchedPost.id && citation.url);
}

function primaryEvidence(exportData, matchedPost, entityIds) {
  const primaryIds = evidenceSourceIds(exportData, matchedPost, entityIds);
  const curated = (exportData.sources || [])
    .filter(source => primaryIds.has(source.id) && source.canonical_url)
    .sort((a, b) => Number((b.cited_by || []).includes(matchedPost.id)) - Number((a.cited_by || []).includes(matchedPost.id)) || String(b.publication_date || b.meeting_date || '').localeCompare(String(a.publication_date || a.meeting_date || '')))
    .map(sourceView);

  const seenUrls = new Set(curated.map(item => evidenceUrlKey(item.url)));
  const citations = directCitations(exportData, matchedPost)
    .filter(citation => domainMatches(citation.domain, PRIMARY_CITATION_DOMAINS))
    .filter(citation => !seenUrls.has(evidenceUrlKey(citation.url)))
    .map(citation => citationView(citation, 'article-primary'));

  const combined = [...curated, ...citations];
  const deduped = [];
  const seen = new Set();
  for (const item of combined) {
    const key = evidenceUrlKey(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, 12);
}

function relatedSourceMaterial(exportData, matchedPost, entityIds, topicIds, entitiesById, frequencies, primary) {
  const totalPosts = (exportData.posts || []).length;
  const primaryIds = evidenceSourceIds(exportData, matchedPost, entityIds);
  const primaryUrls = new Set((primary || []).map(item => evidenceUrlKey(item.url)));

  const curated = (exportData.sources || [])
    .filter(source => !primaryIds.has(source.id) && source.canonical_url && !primaryUrls.has(evidenceUrlKey(source.canonical_url)))
    .map(source => {
      const sharedEntities = (source.related_entities || []).filter(id => entityIds.has(id));
      const sharedTopics = (source.related_topics || []).filter(id => topicIds.has(id));
      const entityScore = sharedEntities.reduce((sum, id) => sum + contextWeight(id, frequencies, totalPosts, entitiesById), 0);
      const topicScore = sharedTopics.reduce((sum, id) => sum + contextWeight(id, frequencies, totalPosts, entitiesById), 0);
      const strongestEntity = Math.max(0, ...sharedEntities.map(id => contextWeight(id, frequencies, totalPosts, entitiesById)));
      return { source, score: entityScore + topicScore, sharedEntities, strongestEntity };
    })
    .filter(entry => entry.sharedEntities.length >= 1 && (entry.strongestEntity >= 4.25 || (entry.sharedEntities.length >= 2 && entry.score >= 5.5)))
    .sort((a, b) => b.score - a.score || String(b.source.publication_date || b.source.meeting_date || '').localeCompare(String(a.source.publication_date || a.source.meeting_date || '')))
    .map(({ source }) => sourceView(source));

  const citationMaterial = directCitations(exportData, matchedPost)
    .filter(citation => !domainMatches(citation.domain, PRIMARY_CITATION_DOMAINS))
    .filter(citation => !domainMatches(citation.domain, EXCLUDED_RELATED_CITATION_DOMAINS))
    .filter(citation => !primaryUrls.has(evidenceUrlKey(citation.url)))
    .map(citation => citationView(citation, 'article-related'));

  const combined = [...citationMaterial, ...curated];
  const deduped = [];
  const seen = new Set(primaryUrls);
  for (const item of combined) {
    const key = evidenceUrlKey(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, 8);
}

function reviewedRelationships(exportData, entityIds) {
  return (exportData.relationships || [])
    .filter(rel => entityIds.has(rel.from) && entityIds.has(rel.to) && rel.review_status === 'reviewed')
    .slice(0, 8)
    .map(rel => ({ id: rel.id, from: rel.from, to: rel.to, type: rel.type, note: rel.note || null }));
}

export default async request => {
  const requestUrl = new URL(request.url);
  const requested = canonicalUrl(requestUrl.searchParams.get('url'));
  if (!requested || !requested.startsWith('https://southallstories.uk/')) {
    return json({ matched: false, reason: 'not-southall-stories' }, 200, 900);
  }

  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const exportData = await response.json();
    if (exportData.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${exportData.schema_version}`);

    const matchedPost = (exportData.posts || []).find(post => canonicalUrl(post.url) === requested);
    if (!matchedPost) return json({ matched: false, reason: 'not-in-research-archive' }, 200, 900);

    const entitiesById = byId(exportData.entities);
    const topicsById = byId(exportData.topics);
    const frequencies = mentionDocumentFrequency(exportData);
    const { entityIds, topicIds } = sharedContext(exportData, matchedPost.id);
    const entities = [...entityIds].map(id => entitiesById.get(id)).filter(Boolean).map(entity => ({ id: entity.id, name: entity.name, type: entity.type })).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const topics = [...topicIds].map(id => topicsById.get(id)).filter(Boolean).map(topic => ({ id: topic.id, name: topic.name })).sort((a, b) => a.name.localeCompare(b.name));
    const primary = primaryEvidence(exportData, matchedPost, entityIds);

    return json({
      matched: true,
      schemaVersion: exportData.schema_version,
      post: { id: matchedPost.id, title: matchedPost.title, date: matchedPost.date, url: matchedPost.url },
      entities,
      topics,
      earlierReporting: relatedEarlierPosts(exportData, matchedPost, entityIds, topicIds, entitiesById, frequencies),
      primaryEvidence: primary,
      relatedSourceMaterial: relatedSourceMaterial(exportData, matchedPost, entityIds, topicIds, entitiesById, frequencies, primary),
      relationships: reviewedRelationships(exportData, entityIds),
      provenance: {
        label: 'Related civic memory',
        source: 'Southall Stories research archive',
        method: 'Exact Southall Stories URL match. Primary evidence includes sources directly cited by the article plus reviewed source records; broader related material is labelled separately.'
      }
    });
  } catch (error) {
    console.error('Civic memory lookup failed', error);
    return json({ matched: false, reason: 'temporarily-unavailable' }, 200, 60);
  }
};
