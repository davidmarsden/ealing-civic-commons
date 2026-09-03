import { findTopicByRoute } from '../lib/topic-registry.mjs';
import { findEntityByProviderId, makeZettelRegistryEntity, providerViews } from '../lib/entity-registry.mjs';
import { ISSUE_REGISTRY } from '../lib/issue-registry.mjs';

const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}
function byId(items = []) { return new Map(items.map(item => [item.id, item])); }
function dateValue(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; }
function topicProviderViews(registryTopic) {
  return providerViews({ providers: registryTopic.providers }).map(provider => {
    if (provider.id === 'civic-commons') return { ...provider, name: 'Ealing Civic Commons', label: 'Ealing Civic Commons', role: 'Live civic source network and canonical public topic', url: 'https://ealing.civiccommons.co.uk/' };
    if (provider.id === 'southall-zettel') return { id: 'reviewed-archive', name: 'Reviewed research archive', label: 'Reviewed research archive', role: 'Historical evidence and reviewed civic memory', url: null, bindingRole: provider.bindingRole || null, entityId: null };
    return provider;
  });
}

export default async request => {
  const route = new URL(request.url).searchParams.get('route');
  const registryTopic = findTopicByRoute(route);
  if (!registryTopic) return json({ matched: false, reason: 'topic-not-in-commons-registry' }, 404, 300);

  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const topicsById = byId(data.topics);
    const entitiesById = byId(data.entities);
    const postsById = byId(data.posts);
    const topic = topicsById.get(registryTopic.providerTopicId);
    if (!topic) return json({ matched: false, reason: 'provider-topic-not-found' }, 404, 300);

    const postIds = new Set((data.links || []).filter(link => link.type === 'mentioned-in' && link.source === topic.id && link.target.startsWith('post:')).map(link => link.target));
    const reporting = [...postIds].map(id => postsById.get(id)).filter(Boolean).sort((a,b) => dateValue(b.date)-dateValue(a.date)).map(post => ({ id: post.id, title: post.title, summary: post.summary, date: post.date, url: post.url, provider: 'reviewed-archive' }));

    const entityCounts = new Map();
    for (const link of data.links || []) {
      if (link.type !== 'mentioned-in' || !link.source.startsWith('entity:') || !postIds.has(link.target)) continue;
      entityCounts.set(link.source, (entityCounts.get(link.source) || 0) + 1);
    }
    const entities = [...entityCounts.entries()].map(([id,count]) => {
      const entity = entitiesById.get(id); if (!entity) return null;
      const registry = findEntityByProviderId('southall-zettel', id) || makeZettelRegistryEntity(entity);
      return { id, name: entity.name, type: entity.type, count, commonsRoute: registry?.route || null };
    }).filter(Boolean).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0,24);

    const sources = (data.sources || []).filter(source => source.review_status === 'reviewed' && (source.related_topics || []).includes(topic.id)).sort((a,b) => dateValue(b.publication_date || b.meeting_date)-dateValue(a.publication_date || a.meeting_date)).map(source => ({ id: source.id, title: source.title, publisher: source.publisher, sourceType: source.source_type, date: source.publication_date || source.meeting_date || null, url: source.canonical_url, provider: 'reviewed-archive' }));

    const issues = ISSUE_REGISTRY.filter(issue => issue.topicIds.includes(topic.id)).map(issue => ({ id: issue.id, route: issue.route, name: issue.name, status: issue.status, description: issue.description }));

    return json({
      matched: true,
      schemaVersion: data.schema_version,
      civicTopic: { id: registryTopic.id, route: registryTopic.route, name: registryTopic.name },
      topic: { id: topic.id, name: registryTopic.name || topic.name, aliases: registryTopic.aliases || topic.aliases || [], description: registryTopic.description || null },
      providers: topicProviderViews(registryTopic),
      feedTopics: registryTopic.feedTopics || [],
      counts: { reporting: reporting.length, entities: entities.length, sources: sources.length, issues: issues.length },
      entities, issues, sources, reporting,
      provenance: { label: 'Civic topic', source: 'Ealing Civic Commons + reviewed research archive', method: 'Ealing Civic Commons owns the public topic route and live current layer. A separately attributed reviewed archive contributes historical evidence and civic memory.' }
    }, 200, 300);
  } catch (error) {
    console.error('Civic topic lookup failed', error);
    return json({ matched: false, reason: 'topic-service-unavailable' }, 200, 60);
  }
};
