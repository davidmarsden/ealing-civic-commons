import { ENTITY_REGISTRY, findEntityByProviderId, makeZettelRegistryEntity, providerViews } from '../lib/entity-registry.mjs';
import { INSTITUTIONAL_ENTITIES } from '../lib/institutional-entities.mjs';
import { COMMUNITY_ENTITIES } from '../lib/community-entities.mjs';
import { PUBLIC_PEOPLE, findPublicPersonByProviderId } from '../lib/public-people.mjs';

const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;
const REFERENCE_LIMIT = 20;

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}

function zettelId(entity) {
  return (entity.providers || []).find(provider => provider.provider === 'southall-zettel' && provider.entityId)?.entityId || null;
}

function sourceFor(entity, sourceByEntity = new Map()) {
  if (entity.website?.url) return entity.website;
  const id = zettelId(entity);
  const source = id ? sourceByEntity.get(id) : null;
  if (!source?.canonical_url) return null;
  return {
    label: source.publisher || source.title || 'Source',
    url: source.canonical_url,
    type: source.source_type || null
  };
}

function view(entity, sourceByEntity = new Map()) {
  return {
    id: entity.id,
    route: entity.route,
    name: entity.name,
    type: entity.type,
    kind: 'profile',
    description: entity.description || null,
    publicRole: entity.type === 'person' ? (entity.publicRole || null) : null,
    roleStatus: entity.type === 'person' ? (entity.roleStatus || null) : null,
    aliases: entity.aliases || [],
    source: sourceFor(entity, sourceByEntity),
    providers: providerViews(entity).map(provider => ({ id: provider.id, label: provider.label, role: provider.role || provider.bindingRole }))
  };
}

function baseRegistry() {
  const byRoute = new Map([...ENTITY_REGISTRY, ...INSTITUTIONAL_ENTITIES, ...COMMUNITY_ENTITIES, ...PUBLIC_PEOPLE].map(entity => [entity.route, entity]));
  return [...byRoute.values()];
}

function curatedSourceLookup(sources = []) {
  const lookup = new Map();
  for (const source of sources) {
    if (!source?.canonical_url) continue;
    for (const entityId of source.related_entities || []) {
      if (!lookup.has(entityId)) lookup.set(entityId, source);
    }
  }
  return lookup;
}

function qualityFor(entities, suppressedResearchPeopleCount = 0) {
  const missingDescriptions = entities.filter(entity => !entity.description).map(entity => entity.route);
  const missingSources = entities.filter(entity => !entity.source).map(entity => entity.route);
  const peopleMissingPublicStanding = entities
    .filter(entity => entity.type === 'person' && !entity.publicRole && !entity.description)
    .map(entity => entity.route);

  return {
    missingDescriptions,
    missingDescriptionCount: missingDescriptions.length,
    missingSources,
    missingSourceCount: missingSources.length,
    peopleMissingPublicStanding,
    peopleMissingPublicStandingCount: peopleMissingPublicStanding.length,
    suppressedResearchPeopleCount
  };
}

function personReference(providerEntity, data) {
  const id = providerEntity.id;
  const postsById = new Map((data.posts || []).map(post => [post.id, post]));
  const mentionedPostIds = [...new Set((data.links || [])
    .filter(link => link.type === 'mentioned-in' && link.source === id && String(link.target || '').startsWith('post:'))
    .map(link => link.target))];
  const reviewedSources = (data.sources || []).filter(source => source.review_status === 'reviewed' && (source.related_entities || []).includes(id));
  const reviewedRelationships = (data.relationships || []).filter(rel => rel.review_status === 'reviewed' && (rel.from === id || rel.to === id));
  const recordCount = mentionedPostIds.length + reviewedSources.length + reviewedRelationships.length;

  // A one-off mention is not enough to create even a search reference. Requiring at least
  // two reviewed civic records/relationships restores useful discovery without recreating
  // a bulk directory of every person ever named in the research corpus.
  if (recordCount < 2) return null;

  const evidence = [];
  for (const postId of mentionedPostIds) {
    const post = postsById.get(postId);
    if (!post?.url) continue;
    evidence.push({ type: 'reporting', title: post.title || 'Related reporting', url: post.url, date: post.date || null });
    if (evidence.length >= 3) break;
  }
  if (evidence.length < 3) {
    for (const source of reviewedSources) {
      if (!source?.canonical_url) continue;
      evidence.push({ type: 'source', title: source.title || source.publisher || 'Public source', url: source.canonical_url, date: source.publication_date || source.meeting_date || null });
      if (evidence.length >= 3) break;
    }
  }

  return {
    id: `reference:${id}`,
    route: null,
    name: providerEntity.name,
    type: 'person',
    kind: 'reference',
    aliases: providerEntity.aliases || [],
    description: null,
    publicRole: null,
    roleStatus: null,
    referenceCount: recordCount,
    evidence
  };
}

function matchingPersonReferences(query, data) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 3) return [];

  const references = [];
  for (const providerEntity of data.entities || []) {
    if (providerEntity.type !== 'person') continue;
    const existing = findEntityByProviderId('southall-zettel', providerEntity.id) || findPublicPersonByProviderId('southall-zettel', providerEntity.id);
    if (existing) continue;
    const names = [providerEntity.name, ...(providerEntity.aliases || [])].filter(Boolean).map(value => String(value).toLowerCase());
    if (!names.some(value => value.includes(q))) continue;
    const reference = personReference(providerEntity, data);
    if (reference) references.push(reference);
    if (references.length >= REFERENCE_LIMIT) break;
  }
  return references.sort((a, b) => a.name.localeCompare(b.name));
}

export default async request => {
  try {
    const requestUrl = new URL(request.url);
    const query = requestUrl.searchParams.get('q') || '';
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const providerById = new Map((data.entities || []).map(entity => [entity.id, entity]));
    const byRoute = new Map();
    let suppressedResearchPeopleCount = 0;

    for (const entity of baseRegistry()) {
      const providerId = zettelId(entity);
      const providerEntity = providerId ? providerById.get(providerId) : null;
      byRoute.set(entity.route, {
        ...entity,
        description: entity.description || providerEntity?.description || null,
        aliases: entity.aliases?.length ? entity.aliases : (providerEntity?.aliases || []),
        website: entity.website || providerEntity?.website || null
      });
    }

    for (const providerEntity of data.entities || []) {
      const existing = findEntityByProviderId('southall-zettel', providerEntity.id) || findPublicPersonByProviderId('southall-zettel', providerEntity.id);

      if (providerEntity.type === 'person' && !existing) {
        suppressedResearchPeopleCount += 1;
        continue;
      }

      const entity = existing || makeZettelRegistryEntity(providerEntity);
      if (!entity) continue;
      const merged = {
        ...entity,
        description: entity.description || providerEntity.description || null,
        aliases: [...new Set([...(entity.aliases || []), ...(providerEntity.aliases || [])])],
        website: entity.website || providerEntity.website || null
      };
      if (!byRoute.has(merged.route)) byRoute.set(merged.route, merged);
    }

    const sourceByEntity = curatedSourceLookup(data.sources || []);
    const entities = [...byRoute.values()].map(entity => view(entity, sourceByEntity)).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const counts = entities.reduce((acc, entity) => { acc[entity.type] = (acc[entity.type] || 0) + 1; return acc; }, {});
    const references = matchingPersonReferences(query, data);

    return json({
      matched: true,
      schemaVersion: 1,
      counts,
      entities,
      references,
      quality: qualityFor(entities, suppressedResearchPeopleCount),
      peoplePolicy: {
        mode: 'profiles-plus-search-references',
        method: 'People with a documented public civic role may have standalone profiles. Other materially recurring people may be returned only as name-search references to reviewed public records; one-off/incidental mentions are not indexed as people.'
      },
      provenance: {
        source: 'Civic Commons entity registry + Southall Stories research archive',
        method: 'Canonical Commons identities are merged with exact reviewed research-archive entity IDs. Public person profiles require deliberate registration. Search-only person references require at least two reviewed civic records or relationships and do not receive a public profile route or aggregated biography.'
      }
    });
  } catch (error) {
    console.error('Civic entity index failed', error);
    const entities = baseRegistry().map(entity => view(entity)).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const counts = entities.reduce((acc, entity) => { acc[entity.type] = (acc[entity.type] || 0) + 1; return acc; }, {});
    return json({
      matched: true,
      degraded: true,
      schemaVersion: 1,
      counts,
      entities,
      references: [],
      quality: qualityFor(entities),
      peoplePolicy: {
        mode: 'profiles-plus-search-references',
        method: 'Only explicitly registered public profiles are exposed while the reviewed research export is unavailable; search-only references are temporarily unavailable.'
      },
      provenance: {
        source: 'Civic Commons entity registry',
        method: 'The historical research export was unavailable; Commons-native and explicitly registered identities remain available.'
      }
    }, 200, 60);
  }
};
