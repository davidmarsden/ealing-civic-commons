import { findIssueByRoute } from '../lib/issue-registry.mjs';
import { findEntityByProviderId, makeZettelRegistryEntity } from '../lib/entity-registry.mjs';

const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}
function byId(items = []) { return new Map(items.map(item => [item.id, item])); }
function dateValue(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; }

export default async request => {
  const url = new URL(request.url);
  const issue = findIssueByRoute(url.searchParams.get('route'));
  if (!issue) return json({ matched: false, reason: 'issue-not-in-commons-registry' }, 404, 300);

  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const entitiesById = byId(data.entities);
    const topicsById = byId(data.topics);
    const postsById = byId(data.posts);
    const selectedEntityIds = new Set(issue.entityIds.filter(id => entitiesById.has(id)));
    const selectedTopicIds = new Set(issue.topicIds.filter(id => topicsById.has(id)));

    const entities = [...selectedEntityIds].map(id => {
      const entity = entitiesById.get(id);
      const registered = findEntityByProviderId('southall-zettel', id) || makeZettelRegistryEntity(entity);
      return { id: entity.id, name: entity.name, type: entity.type, description: entity.description || null, commonsRoute: registered?.route || null };
    });

    const topics = [...selectedTopicIds].map(id => topicsById.get(id)).filter(Boolean).map(topic => ({ id: topic.id, name: topic.name }));

    const postContexts = new Map();
    for (const link of data.links || []) {
      if (link.type !== 'mentioned-in' || !link.target.startsWith('post:')) continue;
      if (!postContexts.has(link.target)) postContexts.set(link.target, new Set());
      postContexts.get(link.target).add(link.source);
    }

    const reporting = (data.posts || []).map(post => {
      const context = postContexts.get(post.id) || new Set();
      const entityHits = [...selectedEntityIds].filter(id => context.has(id));
      const topicHits = [...selectedTopicIds].filter(id => context.has(id));
      const primary = context.has(issue.primaryEntityId);
      const qualifies = primary || entityHits.length >= 2 || (entityHits.length >= 1 && topicHits.length >= 2);
      const score = (primary ? 100 : 0) + entityHits.length * 10 + topicHits.length * 2;
      return { post, qualifies, score, entityHits, topicHits };
    }).filter(entry => entry.qualifies).sort((a, b) => b.score - a.score || dateValue(b.post.date) - dateValue(a.post.date)).map(({ post, entityHits, topicHits }) => ({
      id: post.id, title: post.title, summary: post.summary, date: post.date, url: post.url, categories: post.categories || [], entityMatches: entityHits.length, topicMatches: topicHits.length, provider: 'reviewed-archive'
    }));

    const relationships = (data.relationships || []).filter(rel => rel.review_status === 'reviewed' && (selectedEntityIds.has(rel.from) || selectedEntityIds.has(rel.to))).map(rel => {
      const from = entitiesById.get(rel.from);
      const to = entitiesById.get(rel.to);
      const fromRegistry = from ? findEntityByProviderId('southall-zettel', rel.from) || makeZettelRegistryEntity(from) : null;
      const toRegistry = to ? findEntityByProviderId('southall-zettel', rel.to) || makeZettelRegistryEntity(to) : null;
      const evidence = (rel.evidence || []).map(ref => {
        if (ref.id?.startsWith('post:')) { const post = postsById.get(ref.id); return post ? { id: post.id, title: post.title, url: post.url, type: 'post' } : null; }
        const source = (data.sources || []).find(item => item.id === ref.id);
        return source ? { id: source.id, title: source.title, url: source.canonical_url, type: 'source' } : null;
      }).filter(Boolean);
      return {
        id: rel.id, type: rel.type, note: rel.note || null, validFrom: rel.valid_from || null, validTo: rel.valid_to || null, confidence: rel.confidence,
        from: { id: rel.from, name: from?.name || rel.from, type: from?.type || 'entity', commonsRoute: fromRegistry?.route || null },
        to: { id: rel.to, name: to?.name || rel.to, type: to?.type || 'entity', commonsRoute: toRegistry?.route || null }, evidence, provider: 'reviewed-archive'
      };
    }).sort((a, b) => Number(b.from.id === issue.primaryEntityId || b.to.id === issue.primaryEntityId) - Number(a.from.id === issue.primaryEntityId || a.to.id === issue.primaryEntityId) || a.type.localeCompare(b.type));

    const sources = (data.sources || []).filter(source => source.review_status === 'reviewed').map(source => {
      const entityHits = (source.related_entities || []).filter(id => selectedEntityIds.has(id));
      const topicHits = (source.related_topics || []).filter(id => selectedTopicIds.has(id));
      const primary = entityHits.includes(issue.primaryEntityId);
      const qualifies = primary || entityHits.length >= 2 || (entityHits.length >= 1 && topicHits.length >= 1);
      const score = (primary ? 100 : 0) + entityHits.length * 10 + topicHits.length * 2;
      return { source, qualifies, score };
    }).filter(entry => entry.qualifies).sort((a, b) => b.score - a.score || dateValue(b.source.publication_date || b.source.meeting_date) - dateValue(a.source.publication_date || a.source.meeting_date)).map(({ source }) => ({
      id: source.id, title: source.title, publisher: source.publisher, sourceType: source.source_type, date: source.publication_date || source.meeting_date || null, url: source.canonical_url, archiveUrls: source.archive_urls || [], provider: 'reviewed-archive'
    }));

    return json({
      matched: true,
      schemaVersion: data.schema_version,
      issue: { id: issue.id, route: issue.route, name: issue.name, status: issue.status, description: issue.description, aliases: issue.aliases || [] },
      providers: [
        { id: 'civic-commons', name: 'Ealing Civic Commons', label: 'Ealing Civic Commons', role: 'Live civic source network and canonical public issue', url: 'https://ealing.civiccommons.co.uk/' },
        { id: 'reviewed-archive', name: 'Reviewed research archive', label: 'Reviewed research archive', role: 'Historical evidence and reviewed civic memory', url: null }
      ],
      counts: { entities: entities.length, topics: topics.length, reporting: reporting.length, relationships: relationships.length, sources: sources.length },
      entities, topics, relationships, sources, reporting,
      provenance: { label: 'Civic issue', source: 'Ealing Civic Commons + reviewed research archive', method: 'Ealing Civic Commons defines the ongoing issue and its stable public route. Reviewed historical relationships, source records and reporting are selected from the reviewed archive by exact entity/topic IDs; current Commons material is a separately labelled live layer.' }
    }, 200, 300);
  } catch (error) {
    console.error('Civic issue lookup failed', error);
    return json({ matched: false, reason: 'issue-service-unavailable' }, 200, 60);
  }
};
