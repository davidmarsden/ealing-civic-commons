export const PROVIDERS = {
  'southall-zettel': {
    id: 'southall-zettel',
    name: 'Southall-Zettel',
    label: 'Southall Stories research archive',
    role: 'Reviewed civic memory',
    url: 'https://github.com/davidmarsden/Southall-Zettel'
  },
  'civic-commons': {
    id: 'civic-commons',
    name: 'Civic Commons',
    label: 'Southall & Ealing Civic Commons',
    role: 'Public civic identity and current-source aggregation',
    url: 'https://commons.southallstories.uk/'
  }
};

export const ENTITY_REGISTRY = [
  {
    route: 'places/southall-gasworks',
    id: 'civic:place:southall-gasworks',
    name: 'Southall Gasworks',
    type: 'place',
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: 'entity:southall-gasworks', role: 'reviewed-civic-memory' }
    ]
  },
  {
    route: 'organisations/ealing-council',
    id: 'civic:organisation:ealing-council',
    name: 'Ealing Council',
    type: 'organisation',
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: 'entity:ealing-council', role: 'reviewed-civic-memory' }
    ]
  },
  {
    route: 'people/peter-mason',
    id: 'civic:person:peter-mason',
    name: 'Peter Mason',
    type: 'person',
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: 'entity:peter-mason', role: 'reviewed-civic-memory' }
    ]
  },
  {
    route: 'places/acton',
    id: 'civic:place:acton',
    name: 'Acton',
    type: 'place',
    description: 'One of the seven towns of the London Borough of Ealing.',
    aliases: ['Acton'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'places/greenford',
    id: 'civic:place:greenford',
    name: 'Greenford',
    type: 'place',
    description: 'One of the seven towns of the London Borough of Ealing.',
    aliases: ['Greenford'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'places/hanwell',
    id: 'civic:place:hanwell',
    name: 'Hanwell',
    type: 'place',
    description: 'One of the seven towns of the London Borough of Ealing.',
    aliases: ['Hanwell'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'places/northolt',
    id: 'civic:place:northolt',
    name: 'Northolt',
    type: 'place',
    description: 'One of the seven towns of the London Borough of Ealing.',
    aliases: ['Northolt'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'places/perivale',
    id: 'civic:place:perivale',
    name: 'Perivale',
    type: 'place',
    description: 'One of the seven towns of the London Borough of Ealing.',
    aliases: ['Perivale'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  }
];

export const ROUTE_TO_TYPE = new Map([
  ['people', 'person'],
  ['organisations', 'organisation'],
  ['places', 'place']
]);

export const TYPE_TO_ROUTE = new Map([
  ['person', 'people'],
  ['organisation', 'organisations'],
  ['place', 'places']
]);

export function normaliseEntityRoute(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
}

export function parseEntityRoute(value) {
  const route = normaliseEntityRoute(value);
  const [segment, slug, ...rest] = route.split('/');
  if (!segment || !slug || rest.length || !ROUTE_TO_TYPE.has(segment)) return null;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  return { route, segment, slug, type: ROUTE_TO_TYPE.get(segment) };
}

export function findEntityByRoute(value) {
  const route = normaliseEntityRoute(value);
  return ENTITY_REGISTRY.find(entity => entity.route === route) || null;
}

export function findEntityByProviderId(provider, entityId) {
  return ENTITY_REGISTRY.find(entity => entity.providers.some(item => item.provider === provider && item.entityId === entityId)) || null;
}

export function makeZettelRegistryEntity(entity) {
  if (!entity?.id?.startsWith('entity:') || !TYPE_TO_ROUTE.has(entity.type)) return null;
  const slug = entity.id.slice('entity:'.length);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return null;
  const segment = TYPE_TO_ROUTE.get(entity.type);
  return {
    route: `${segment}/${slug}`,
    id: `civic:${entity.type}:${slug}`,
    name: entity.name,
    type: entity.type,
    description: entity.description || null,
    aliases: entity.aliases || [],
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: entity.id, role: 'reviewed-civic-memory' }
    ]
  };
}

export function providerViews(entity) {
  return (entity?.providers || []).map(binding => ({ ...PROVIDERS[binding.provider], bindingRole: binding.role, entityId: binding.entityId || null })).filter(provider => provider.id);
}
