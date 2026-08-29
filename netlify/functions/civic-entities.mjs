import { ENTITY_REGISTRY, findEntityByProviderId, makeZettelRegistryEntity, providerViews } from '../lib/entity-registry.mjs';

const EXPORT_URL = 'https://raw.githubusercontent.com/davidmarsden/Southall-Zettel/main/generated/commons.json';
const EXPECTED_SCHEMA = 1;

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}

function view(entity) {
  return {
    id: entity.id,
    route: entity.route,
    name: entity.name,
    type: entity.type,
    description: entity.description || null,
    aliases: entity.aliases || [],
    providers: providerViews(entity).map(provider => ({ id: provider.id, label: provider.label, role: provider.role || provider.bindingRole }))
  };
}

export default async () => {
  try {
    const response = await fetch(EXPORT_URL, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Research archive export HTTP ${response.status}`);
    const data = await response.json();
    if (data.schema_version !== EXPECTED_SCHEMA) throw new Error(`Unsupported research archive schema ${data.schema_version}`);

    const byRoute = new Map(ENTITY_REGISTRY.map(entity => [entity.route, entity]));
    for (const providerEntity of data.entities || []) {
      const existing = findEntityByProviderId('southall-zettel', providerEntity.id);
      const entity = existing || makeZettelRegistryEntity(providerEntity);
      if (entity && !byRoute.has(entity.route)) byRoute.set(entity.route, entity);
    }

    const entities = [...byRoute.values()].map(view).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const counts = entities.reduce((acc, entity) => { acc[entity.type] = (acc[entity.type] || 0) + 1; return acc; }, {});
    return json({ matched: true, schemaVersion: 1, counts, entities, provenance: { source: 'Civic Commons entity registry + reviewed Southall-Zettel public export', method: 'Canonical Commons identities merged with exact provider entity IDs. Commons-native records remain valid without a Zettel provider.' } });
  } catch (error) {
    console.error('Civic entity index failed', error);
    const entities = ENTITY_REGISTRY.map(view).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const counts = entities.reduce((acc, entity) => { acc[entity.type] = (acc[entity.type] || 0) + 1; return acc; }, {});
    return json({ matched: true, degraded: true, schemaVersion: 1, counts, entities, provenance: { source: 'Civic Commons entity registry', method: 'Southall-Zettel export was unavailable; Commons-native and explicitly registered identities remain available.' } }, 200, 60);
  }
};
