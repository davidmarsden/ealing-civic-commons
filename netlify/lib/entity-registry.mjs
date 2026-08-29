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
    route: 'people/monica-hamidi',
    id: 'civic:person:monica-hamidi',
    name: 'Monica Hamidi',
    type: 'person',
    description: 'Ealing councillor and Cabinet Member for Good Growth, covering regeneration and planning policy.',
    aliases: ['Cllr Monica Hamidi'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/dominic-moffitt',
    id: 'civic:person:dominic-moffitt',
    name: 'Dominic Moffitt',
    type: 'person',
    description: 'Ealing councillor and Cabinet Member for Climate Action, including air quality, transport, waste and environmental policy.',
    aliases: ['Cllr Dominic Moffitt'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/anthony-kelly',
    id: 'civic:person:anthony-kelly',
    name: 'Anthony Kelly',
    type: 'person',
    description: 'Ealing councillor and Chair of the Overview and Scrutiny Committee for 2026/27.',
    aliases: ['Cllr Anthony Kelly'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/gary-busuttil',
    id: 'civic:person:gary-busuttil',
    name: 'Gary Busuttil',
    type: 'person',
    description: 'Ealing councillor, Vice Chair of the Overview and Scrutiny Committee for 2026/27 and Liberal Democrat transport spokesperson.',
    aliases: ['Cllr Gary Busuttil'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/miriam-rice',
    id: 'civic:person:miriam-rice',
    name: 'Miriam Rice',
    type: 'person',
    description: 'Ealing councillor and Chair of the Housing and Environment Scrutiny Panel for 2026/27.',
    aliases: ['Cllr Miriam Rice'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/athena-zissimos',
    id: 'civic:person:athena-zissimos',
    name: 'Athena Zissimos',
    type: 'person',
    description: 'Ealing councillor, Vice Chair of the Housing and Environment Scrutiny Panel for 2026/27 and Liberal Democrat environment and crime spokesperson.',
    aliases: ['Cllr Athena Zissimos'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/hitesh-tailor',
    id: 'civic:person:hitesh-tailor',
    name: 'Hitesh Tailor',
    type: 'person',
    description: 'Ealing councillor and Chair of the Economy and Sustainability Scrutiny Panel for 2026/27.',
    aliases: ['Cllr Hitesh Tailor'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/dee-martin',
    id: 'civic:person:dee-martin',
    name: 'Dee Martin',
    type: 'person',
    description: 'Ealing councillor and Chair of the Planning Committee for 2026/27.',
    aliases: ['Cllr Dee Martin'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/katie-douglas',
    id: 'civic:person:katie-douglas',
    name: 'Katie Douglas',
    type: 'person',
    description: 'Ealing councillor and Vice Chair of the Planning Committee for 2026/27.',
    aliases: ['Cllr Katie Douglas'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/gary-malcolm',
    id: 'civic:person:gary-malcolm',
    name: 'Gary Malcolm',
    type: 'person',
    description: 'Ealing councillor and Leader of the Opposition for 2026/27.',
    aliases: ['Cllr Gary Malcolm'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/jon-ball',
    id: 'civic:person:jon-ball',
    name: 'Jon Ball',
    type: 'person',
    description: 'Ealing councillor and Liberal Democrat opposition spokesperson for planning, licensing and regeneration.',
    aliases: ['Cllr Jon Ball'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/jonathan-oxley',
    id: 'civic:person:jonathan-oxley',
    name: 'Jonathan Oxley',
    type: 'person',
    description: 'Ealing councillor and Liberal Democrat opposition spokesperson for finance.',
    aliases: ['Cllr Jonathan Oxley'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/mark-sanders',
    id: 'civic:person:mark-sanders',
    name: 'Mark Sanders',
    type: 'person',
    description: 'Ealing councillor and Liberal Democrat opposition spokesperson for honesty and accountability.',
    aliases: ['Cllr Mark Sanders'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/adam-keenan',
    id: 'civic:person:adam-keenan',
    name: 'Adam Keenan',
    type: 'person',
    description: 'Ealing councillor and Liberal Democrat opposition spokesperson for children’s services.',
    aliases: ['Cllr Adam Keenan'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/andrew-steed',
    id: 'civic:person:andrew-steed',
    name: 'Andrew Steed',
    type: 'person',
    description: 'Ealing councillor and Liberal Democrat opposition spokesperson for adult services.',
    aliases: ['Cllr Andrew Steed'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/connie-hersch',
    id: 'civic:person:connie-hersch',
    name: 'Connie Hersch',
    type: 'person',
    description: 'Ealing councillor and Deputy Leader of the Ealing Liberal Democrat group after the May 2026 election.',
    aliases: ['Cllr Connie Hersch'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/overview-and-scrutiny-committee',
    id: 'civic:organisation:overview-and-scrutiny-committee',
    name: 'Overview and Scrutiny Committee',
    type: 'organisation',
    description: 'Ealing Council committee responsible for overview and scrutiny across the council and for considering called-in executive decisions.',
    aliases: ['OSC'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/housing-and-environment-scrutiny-panel',
    id: 'civic:organisation:housing-and-environment-scrutiny-panel',
    name: 'Housing and Environment Scrutiny Panel',
    type: 'organisation',
    description: 'Ealing Council scrutiny panel covering housing and environmental matters.',
    aliases: ['Housing & Environment Scrutiny Panel'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/economy-and-sustainability-scrutiny-panel',
    id: 'civic:organisation:economy-and-sustainability-scrutiny-panel',
    name: 'Economy and Sustainability Scrutiny Panel',
    type: 'organisation',
    description: 'Ealing Council scrutiny panel covering economy and sustainability matters.',
    aliases: ['Economy & Sustainability Scrutiny Panel'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/planning-committee',
    id: 'civic:organisation:planning-committee',
    name: 'Planning Committee',
    type: 'organisation',
    description: 'Ealing Council committee that determines planning applications and related planning matters within its remit.',
    aliases: ['Ealing Planning Committee'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
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
