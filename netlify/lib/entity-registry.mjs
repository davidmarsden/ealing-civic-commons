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
  }
];

export function normaliseEntityRoute(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
}

export function findEntityByRoute(value) {
  const route = normaliseEntityRoute(value);
  return ENTITY_REGISTRY.find(entity => entity.route === route) || null;
}

export function findEntityByProviderId(provider, entityId) {
  return ENTITY_REGISTRY.find(entity => entity.providers.some(item => item.provider === provider && item.entityId === entityId)) || null;
}

export function providerViews(entity) {
  return (entity?.providers || []).map(binding => ({ ...PROVIDERS[binding.provider], bindingRole: binding.role, entityId: binding.entityId || null })).filter(provider => provider.id);
}
