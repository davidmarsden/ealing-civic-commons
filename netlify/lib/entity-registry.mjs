export const PROVIDERS = {
  'southall-zettel': {
    id: 'southall-zettel',
    name: 'Southall Stories research archive',
    label: 'Southall Stories research archive',
    role: 'Reviewed civic memory',
    url: 'https://southallstories.uk/'
  },
  'civic-commons': {
    id: 'civic-commons',
    name: 'Civic Commons',
    label: 'Ealing Civic Commons',
    role: 'Public civic identity and current-source aggregation',
    url: 'https://ealing.civiccommons.co.uk/'
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
    route: 'organisations/ealing-labour-group',
    id: 'civic:organisation:ealing-labour-group',
    name: 'Ealing Labour Group',
    type: 'organisation',
    description: 'The Labour political group on Ealing Council. Labour won 46 of 70 council seats in May 2026 and retained control of the council.',
    aliases: ['Labour Group'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/ealing-liberal-democrat-group',
    id: 'civic:organisation:ealing-liberal-democrat-group',
    name: 'Ealing Liberal Democrat Group',
    type: 'organisation',
    description: 'The Liberal Democrat political group on Ealing Council and the main opposition group after the May 2026 election.',
    aliases: ['Ealing Lib Dem Group', 'Liberal Democrat Group'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/ealing-conservative-group',
    id: 'civic:organisation:ealing-conservative-group',
    name: 'Ealing Conservative Group',
    type: 'organisation',
    description: 'The Conservative political group on Ealing Council. Five Conservative councillors were elected in May 2026.',
    aliases: ['Conservative Group'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/ealing-green-group',
    id: 'civic:organisation:ealing-green-group',
    name: 'Ealing Green Group',
    type: 'organisation',
    description: 'The Green political group on Ealing Council. Five Green Party councillors were elected in May 2026.',
    aliases: ['Green Group'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
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
    route: 'people/louise-brett',
    id: 'civic:person:louise-brett',
    name: 'Louise Brett',
    type: 'person',
    description: 'Ealing councillor, Deputy Leader of Ealing Council and Cabinet Member for Safe and Genuinely Affordable Homes.',
    aliases: ['Cllr Louise Brett'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/steve-donnelly',
    id: 'civic:person:steve-donnelly',
    name: 'Steve Donnelly',
    type: 'person',
    description: 'Ealing councillor and Cabinet Member for Inclusive Economy and Efficiency.',
    aliases: ['Cllr Steve Donnelly'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/kamaljit-dhindsa',
    id: 'civic:person:kamaljit-dhindsa',
    name: 'Kamaljit Dhindsa',
    type: 'person',
    aliases: ['Cllr Kamaljit Dhindsa'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'places/walpole-park',
    id: 'civic:place:walpole-park',
    name: 'Walpole Park',
    type: 'place',
    description: 'A major public park in central Ealing and a recurring site of civic, cultural and planning interest.',
    aliases: ['Walpole Park, Ealing'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  }
];

export function parseEntityRoute(route = '') {
  const match = String(route).match(/^(people|organisations|places)\/([a-z0-9-]+)$/);
  if (!match) return null;
  return { segment: match[1], slug: match[2], type: match[1] === 'people' ? 'person' : match[1] === 'organisations' ? 'organisation' : 'place' };
}

export function findEntityByRoute(route) {
  return ENTITY_REGISTRY.find(entity => entity.route === route) || null;
}

export function findEntityByProviderId(provider, entityId) {
  return ENTITY_REGISTRY.find(entity => entity.providers.some(binding => binding.provider === provider && binding.entityId === entityId)) || null;
}

export function providerViews(entity) {
  return (entity?.providers || []).map(binding => {
    const provider = PROVIDERS[binding.provider] || { id: binding.provider, name: binding.provider, label: binding.provider, role: 'External provider', url: null };
    return { ...provider, bindingRole: binding.role || null, entityId: binding.entityId || null };
  });
}

export function makeZettelRegistryEntity(providerEntity) {
  if (!providerEntity?.id || !providerEntity?.name || !providerEntity?.type) return null;
  const slug = providerEntity.id.replace(/^entity:/, '');
  const segment = providerEntity.type === 'person' ? 'people' : providerEntity.type === 'organisation' ? 'organisations' : 'places';
  return {
    route: `${segment}/${slug}`,
    id: `civic:${providerEntity.type}:${slug}`,
    name: providerEntity.name,
    type: providerEntity.type,
    aliases: providerEntity.aliases || [],
    description: providerEntity.description || null,
    website: providerEntity.website || null,
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: providerEntity.id, role: 'reviewed-civic-memory' }
    ]
  };
}
