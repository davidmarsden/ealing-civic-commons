export const PUBLIC_PEOPLE = [
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
