import { findEntityByProviderId, findEntityByRoute, makeZettelRegistryEntity, parseEntityRoute, providerViews } from '../lib/entity-registry.mjs';
import { findInstitutionalEntityByRoute } from '../lib/institutional-entities.mjs';
import { findCommunityEntityByRoute } from '../lib/community-entities.mjs';

const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}

function byId(items = []) { return new Map(items.map(item => [item.id, item])); }
function dateValue(value) { const n = Date.parse(value || ''); return Number.isFinite(n) ? n : 0; }

function registryView(entity) {
  return { id: entity.id, route: entity.route, name: entity.name, type: entity.type };
}

function nativeEntityResponse(registryEntity) {
  return json({
    matched: true,
    schemaVersion: 1,
    civicEntity: registryView(registryEntity),
    entity: {
      id: registryEntity.id,
      name: registryEntity.name,
      type: registryEntity.type,
      aliases: registryEntity.aliases || [],
      description: registryEntity.description || null,
      website: registryEntity.website || null,
      provenance: 'commons-entity-registry'
    },
    providers: providerViews(registryEntity),
    counts: { reporting: 0, relationships: 0, sources: 0 },
    relationships: [], sources: [], reporting: [], topics: [],
    provenance: { label: 'Civic entity', source: 'Civic Commons entity registry', method: 'Canonical Commons identity with no historical research-archive record attached.' }
  }, 200, 300);
}

export default async request => {
  const requestUrl = new URL(request.url);
  const route = requestUrl.searchParams.get('route');
  const legacyId = requestUrl.searchParams.get('id');
  let registryEntity = route ? (findEntityByRoute(route) || findInstitutionalEntityByRoute(route) || findCommunityEntityByRoute(route)) : legacyId ? findEntityByProviderId('southall-zettel', legacyId) : null;

  if (registryEntity && !registryEntity.providers.some(provider => provider.provider === 'southall-zettel' && provider.entityId)) {
    return nativeEntityResponse(registryEntity);
  }

  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const entitiesById = byId(data.entities);
    const topicsById = byId(data.topics);
    const postsById = byId(data.posts);

    if (!registryEntity && route) {
      const parsed = parseEntityRoute(route);
      if (!parsed) return json({ matched: false, reason: 'invalid-entity-route' }, 400, 300);
      const providerEntity = entitiesById.get(`entity:${parsed.slug}`);
      if (!providerEntity || providerEntity.type !== parsed.type) return json({ matched: false, reason: 'entity-not-in-commons-registry' }, 404, 300);
      registryEntity = makeZettelRegistryEntity(providerEntity);
    }

    if (!registryEntity && legacyId) {
      const providerEntity = entitiesById.get(legacyId);
      registryEntity = makeZettelRegistryEntity(providerEntity);
    }

    if (!registryEntity) return json({ matched: false, reason: 'entity-not-in-commons-registry' }, 404, 300);

    const zettelBinding = registryEntity.providers.find(provider => provider.provider === 'southall-zettel' && provider.entityId);
    if (!zettelBinding) return nativeEntityResponse(registryEntity);

    const providers = providerViews(registryEntity);
    const id = zettelBinding.entityId;
    const entity = entitiesById.get(id);
    if (!entity) return json({ matched: false, reason: 'provider-entity-not-found' }, 404, 300);

    const postIds = new Set((data.links || []).filter(link => link.type === 'mentioned-in' && link.source === id && link.target.startsWith('post:')).map(link => link.target));
    const reporting = [...postIds].map(postId => postsById.get(postId)).filter(Boolean).sort((a, b) => dateValue(b.date) - dateValue(a.date)).map(post => ({ id: post.id, title: post.title, summary: post.summary, date: post.date, url: post.url, categories: post.categories || [], provider: 'southall-zettel' }));

    const relationships = (data.relationships || []).filter(rel => rel.review_status === 'reviewed' && (rel.from === id || rel.to === id)).map(rel => {
      const otherId = rel.from === id ? rel.to : rel.from;
      const other = entitiesById.get(otherId);
      const otherRegistry = findEntityByProviderId('southall-zettel', otherId) || makeZettelRegistryEntity(other);
      const evidence = (rel.evidence || []).map(ref => {
        if (ref.id.startsWith('post:')) { const post = postsById.get(ref.id); return post ? { id: post.id, type: 'post', title: post.title, url: post.url, provider: 'southall-zettel' } : null; }
        const source = (data.sources || []).find(item => item.id === ref.id);
        return source ? { id: source.id, type: 'source', title: source.title, url: source.canonical_url, provider: 'southall-zettel' } : null;
      }).filter(Boolean);
      return { id: rel.id, direction: rel.from === id ? 'outgoing' : 'incoming', type: rel.type, other: other ? { id: other.id, name: other.name, type: other.type, commonsRoute: otherRegistry?.route || null } : { id: otherId, name: otherId, type: 'entity', commonsRoute: null }, note: rel.note || null, validFrom: rel.valid_from || null, validTo: rel.valid_to || null, confidence: rel.confidence, evidence, provider: 'southall-zettel' };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.other.name.localeCompare(b.other.name));

    const sources = (data.sources || []).filter(source => source.review_status === 'reviewed' && (source.related_entities || []).includes(id)).sort((a, b) => dateValue(b.publication_date || b.meeting_date) - dateValue(a.publication_date || a.meeting_date)).map(source => ({ id: source.id, title: source.title, publisher: source.publisher, sourceType: source.source_type, date: source.publication_date || source.meeting_date || null, url: source.canonical_url, archiveUrls: source.archive_urls || [], citedBy: source.cited_by || [], provider: 'southall-zettel' }));

    const topicCounts = new Map();
    for (const link of data.links || []) {
      if (link.type !== 'mentioned-in' || !link.source.startsWith('topic:') || !postIds.has(link.target)) continue;
      topicCounts.set(link.source, (topicCounts.get(link.source) || 0) + 1);
    }
    const topics = [...topicCounts.entries()].map(([topicId, count]) => ({ ...(topicsById.get(topicId) || { id: topicId, name: topicId }), count, provider: 'southall-zettel' })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10);

    return json({
      matched: true,
      schemaVersion: data.schema_version,
      civicEntity: registryView(registryEntity),
      entity: { id: entity.id, name: registryEntity.name || entity.name, type: registryEntity.type || entity.type, aliases: entity.aliases || registryEntity.aliases || [], description: entity.description || registryEntity.description || null, website: registryEntity.website || entity.website || null, reviewStatus: entity.review_status, provenance: entity.provenance },
      providers,
      counts: { reporting: reporting.length, relationships: relationships.length, sources: sources.length },
      relationships, sources, reporting, topics,
      provenance: { label: 'Civic memory', source: 'Southall Stories research archive via the Civic Commons entity registry', method: 'Civic Commons owns the public civic identity and route. The Southall Stories research archive supplies reviewed identity metadata, relationships, source records and deterministic historical-reporting matches as one provider.' }
    }, 200, 300);
  } catch (error) {
    console.error('Civic entity lookup failed', error);
    return json({ matched: false, reason: 'entity-service-unavailable' }, 200, 60);
  }
};
