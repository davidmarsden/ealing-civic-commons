const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}

function byId(items = []) { return new Map(items.map(item => [item.id, item])); }
function dateValue(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; }

export default async request => {
  const requestUrl = new URL(request.url);
  const id = requestUrl.searchParams.get('id');
  if (!id || !id.startsWith('entity:')) return json({ matched: false, reason: 'invalid-entity-id' }, 400, 60);

  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const entitiesById = byId(data.entities);
    const topicsById = byId(data.topics);
    const postsById = byId(data.posts);
    const entity = entitiesById.get(id);
    if (!entity) return json({ matched: false, reason: 'entity-not-found' }, 404, 900);

    const postIds = new Set((data.links || []).filter(link => link.type === 'mentioned-in' && link.source === id && link.target.startsWith('post:')).map(link => link.target));
    const reporting = [...postIds].map(postId => postsById.get(postId)).filter(Boolean).sort((a, b) => dateValue(b.date) - dateValue(a.date)).map(post => ({ id: post.id, title: post.title, summary: post.summary, date: post.date, url: post.url, categories: post.categories || [] }));

    const relationships = (data.relationships || []).filter(rel => rel.review_status === 'reviewed' && (rel.from === id || rel.to === id)).map(rel => {
      const otherId = rel.from === id ? rel.to : rel.from;
      const other = entitiesById.get(otherId);
      const evidence = (rel.evidence || []).map(ref => {
        if (ref.id.startsWith('post:')) { const post = postsById.get(ref.id); return post ? { id: post.id, type: 'post', title: post.title, url: post.url } : null; }
        const source = (data.sources || []).find(item => item.id === ref.id);
        return source ? { id: source.id, type: 'source', title: source.title, url: source.canonical_url } : null;
      }).filter(Boolean);
      return { id: rel.id, direction: rel.from === id ? 'outgoing' : 'incoming', type: rel.type, other: other ? { id: other.id, name: other.name, type: other.type } : { id: otherId, name: otherId, type: 'entity' }, note: rel.note || null, validFrom: rel.valid_from || null, validTo: rel.valid_to || null, confidence: rel.confidence, evidence };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.other.name.localeCompare(b.other.name));

    const sources = (data.sources || []).filter(source => source.review_status === 'reviewed' && (source.related_entities || []).includes(id)).sort((a, b) => dateValue(b.publication_date || b.meeting_date) - dateValue(a.publication_date || a.meeting_date)).map(source => ({ id: source.id, title: source.title, publisher: source.publisher, sourceType: source.source_type, date: source.publication_date || source.meeting_date || null, url: source.canonical_url, archiveUrls: source.archive_urls || [], citedBy: source.cited_by || [] }));

    const topicCounts = new Map();
    for (const link of data.links || []) {
      if (link.type !== 'mentioned-in' || !link.source.startsWith('topic:') || !postIds.has(link.target)) continue;
      topicCounts.set(link.source, (topicCounts.get(link.source) || 0) + 1);
    }
    const topics = [...topicCounts.entries()].map(([topicId, count]) => ({ ...(topicsById.get(topicId) || { id: topicId, name: topicId }), count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10);

    return json({ matched: true, schemaVersion: data.schema_version, entity: { id: entity.id, name: entity.name, type: entity.type, aliases: entity.aliases || [], description: entity.description || null, reviewStatus: entity.review_status, provenance: entity.provenance }, counts: { reporting: reporting.length, relationships: relationships.length, sources: sources.length }, relationships, sources, reporting, topics, provenance: { label: 'Civic memory', source: 'Southall Stories research archive', method: 'Curated entity plus reviewed relationships and source records; reporting links are deterministic alias matches over the preserved Southall Stories corpus.' } }, 200, 300);
  } catch (error) {
    console.error('Civic entity lookup failed', error);
    return json({ matched: false, reason: 'entity-service-unavailable' }, 200, 60);
  }
};
