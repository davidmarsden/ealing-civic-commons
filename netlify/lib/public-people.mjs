export const PUBLIC_PEOPLE = [
  {
    route: 'people/david-marsden',
    id: 'civic:person:david-marsden',
    name: 'David Marsden',
    type: 'person',
    description: 'Southall-based investigative journalist, publisher of Southall Stories and community campaigner whose work focuses on local democracy, planning, air pollution, public services and civic accountability in Ealing.',
    publicRole: 'Investigative journalist and publisher of Southall Stories',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'Southall Stories — About', url: 'https://southallstories.uk/about/' },
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: 'entity:david-marsden', role: 'reviewed-civic-memory' }
    ]
  },
  {
    route: 'people/jags-sanghera',
    id: 'civic:person:jags-sanghera',
    name: 'Jags Sanghera',
    type: 'person',
    description: 'Ealing councillor for Norwood Green and chair of Southall Community Alliance, with a longstanding public role in Southall community organisations and local civic life.',
    publicRole: 'Ealing councillor for Norwood Green and chair of Southall Community Alliance',
    roleStatus: 'current',
    aliases: ['Jags Sangera', 'Cllr Jags Sanghera', 'Councillor Jags Sanghera'],
    website: { label: 'Southall Community Alliance', url: 'https://southallcommunityalliance.com/' },
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-identity' },
      { provider: 'southall-zettel', entityId: 'entity:jags-sanghera', role: 'reviewed-civic-memory' }
    ]
  }
];

export function findPublicPersonByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return PUBLIC_PEOPLE.find(entity => entity.route === route) || null;
}

export function findPublicPersonByProviderId(provider, entityId) {
  return PUBLIC_PEOPLE.find(entity => (entity.providers || []).some(binding => binding.provider === provider && binding.entityId === entityId)) || null;
}
