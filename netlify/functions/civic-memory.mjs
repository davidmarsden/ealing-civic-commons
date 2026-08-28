const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

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

function relatedEarlierPosts(exportData, matchedPost, entityIds, topicIds) {
  const scores = new Map();
  for (const link of exportData.links || []) {
    if (link.type !== 'mentioned-in' || !link.target.startsWith('post:')) continue;
    if (!entityIds.has(link.source) && !topicIds.has(link.source)) continue;
    scores.set(link.target, (scores.get(link.target) || 0) + (entityIds.has(link.source) ? 2 : 1));
  }
  const matchedDate = dateValue(matchedPost.date);
  return (exportData.posts || [])
    .filter(post => post.id !== matchedPost.id && scores.has(post.id) && dateValue(post.date) < matchedDate)
    .sort((a, b) => (scores.get(b.id) - scores.get(a.id)) || (dateValue(b.date) - dateValue(a.date)))
    .slice(0, 5)
    .map(post => ({ id: post.id, title: post.title, date: post.date, url: post.url }));
}

function relevantSources(exportData, matchedPost, entityIds, topicIds) {
  return (exportData.sources || [])
    .map(source => {
      let score = 0;
      if ((source.cited_by || []).includes(matchedPost.id)) score += 10;
      score += (source.related_entities || []).filter(id => entityIds.has(id)).length * 2;
      score += (source.related_topics || []).filter(id => topicIds.has(id)).length;
      return { source, score };
    })
    .filter(entry => entry.score > 0 && entry.source.canonical_url)
    .sort((a, b) => b.score - a.score || String(b.source.publication_date || '').localeCompare(String(a.source.publication_date || '')))
    .slice(0, 5)
    .map(({ source }) => ({
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      sourceType: source.source_type,
      date: source.publication_date || source.meeting_date || null,
      url: source.canonical_url
    }));
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
    if (!response.ok) throw new Error(`Zettel export HTTP ${response.status}`);
    const exportData = await response.json();
    if (exportData.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported Zettel schema ${exportData.schema_version}`);

    const matchedPost = (exportData.posts || []).find(post => canonicalUrl(post.url) === requested);
    if (!matchedPost) return json({ matched: false, reason: 'not-in-zettel' }, 200, 900);

    const entitiesById = byId(exportData.entities);
    const topicsById = byId(exportData.topics);
    const { entityIds, topicIds } = sharedContext(exportData, matchedPost.id);
    const entities = [...entityIds].map(id => entitiesById.get(id)).filter(Boolean).map(entity => ({ id: entity.id, name: entity.name, type: entity.type })).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const topics = [...topicIds].map(id => topicsById.get(id)).filter(Boolean).map(topic => ({ id: topic.id, name: topic.name })).sort((a, b) => a.name.localeCompare(b.name));

    return json({
      matched: true,
      schemaVersion: exportData.schema_version,
      post: { id: matchedPost.id, title: matchedPost.title, date: matchedPost.date, url: matchedPost.url },
      entities,
      topics,
      earlierReporting: relatedEarlierPosts(exportData, matchedPost, entityIds, topicIds),
      sources: relevantSources(exportData, matchedPost, entityIds, topicIds),
      relationships: reviewedRelationships(exportData, entityIds),
      provenance: {
        label: 'Related civic memory',
        source: 'Southall-Zettel',
        sourceUrl: 'https://github.com/davidmarsden/Southall-Zettel',
        method: 'Exact Southall Stories URL match; reviewed entities/sources/relationships plus deterministic alias links.'
      }
    });
  } catch (error) {
    console.error('Civic memory lookup failed', error);
    return json({ matched: false, reason: 'temporarily-unavailable' }, 200, 60);
  }
};
