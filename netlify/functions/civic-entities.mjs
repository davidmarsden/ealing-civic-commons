import { ENTITY_REGISTRY, findEntityByProviderId, makeZettelRegistryEntity, providerViews } from '../lib/entity-registry.mjs';
import { INSTITUTIONAL_ENTITIES } from '../lib/institutional-entities.mjs';
import { COMMUNITY_ENTITIES } from '../lib/community-entities.mjs';

const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

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
    description: entity.description || null,
    aliases: entity.aliases || [],
    source: sourceFor(entity, sourceByEntity),
    providers: providerViews(entity).map(provider => ({ id: provider.id, label: provider.label, role: provider.role || provider.bindingRole }))
  };
}

function baseRegistry() {
  return [...ENTITY_REGISTRY, ...INSTITUTIONAL_ENTITIES, ...COMMUNITY_ENTITIES];
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

export default async () => {
  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const providerById = new Map((data.entities || []).map(entity => [entity.id, entity]));
    const byRoute = new Map();

    for (const entity of baseRegistry()) {
      const providerId = zettelId(entity);
      const providerEntity = providerId ? providerById.get(providerId) : null;
      byRoute.set(entity.route, {
        ...entity,
        description: entity.description || providerEntity?.description || null,
        aliases: entity.aliases?.length ? entity.aliases : (providerEntity?.aliases || [])
      });
    }

    for (const providerEntity of data.entities || []) {
      const existing = findEntityByProviderId('southall-zettel', providerEntity.id);
      const entity = existing || makeZettelRegistryEntity(providerEntity);
      if (!entity) continue;
      const merged = {
        ...entity,
        description: entity.description || providerEntity.description || null,
        aliases: entity.aliases?.length ? entity.aliases : (providerEntity.aliases || [])
      };
      if (!byRoute.has(merged.route)) byRoute.set(merged.route, merged);
    }

    const sourceByEntity = curatedSourceLookup(data.sources || []);
    const entities = [...byRoute.values()].map(entity => view(entity, sourceByEntity)).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const counts = entities.reduce((acc, entity) => { acc[entity.type] = (acc[entity.type] || 0) + 1; return acc; }, {});
    const missingDescriptions = entities.filter(entity => !entity.description).map(entity => entity.route);

    return json({
      matched: true,
      schemaVersion: 1,
      counts,
      entities,
      quality: { missingDescriptions, missingDescriptionCount: missingDescriptions.length },
      provenance: {
        source: 'Civic Commons entity registry + Southall Stories research archive',
        method: 'Canonical Commons identities are merged with exact reviewed research-archive entity IDs. Entity note prose supplies descriptions when no Commons-specific description exists; reviewed source records may supply an external source link.'
      }
    });
  } catch (error) {
    console.error('Civic entity index failed', error);
    const entities = baseRegistry().map(entity => view(entity)).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const counts = entities.reduce((acc, entity) => { acc[entity.type] = (acc[entity.type] || 0) + 1; return acc; }, {});
    const missingDescriptions = entities.filter(entity => !entity.description).map(entity => entity.route);
    return json({ matched: true, degraded: true, schemaVersion: 1, counts, entities, quality: { missingDescriptions, missingDescriptionCount: missingDescriptions.length }, provenance: { source: 'Civic Commons entity registry', method: 'The historical research export was unavailable; Commons-native and explicitly registered identities remain available.' } }, 200, 60);
  }
};
