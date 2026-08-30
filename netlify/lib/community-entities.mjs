export const COMMUNITY_ENTITIES = [
  {
    route: 'organisations/ealing-citizens',
    id: 'civic:organisation:ealing-citizens',
    name: 'Ealing Citizens',
    type: 'organisation',
    description: 'A borough-wide alliance of faith, education, charity and community organisations organising around housing, work, pay and other local priorities as part of West London Citizens.',
    aliases: ['Ealing Citizens Alliance'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/west-london-citizens',
    id: 'civic:organisation:west-london-citizens',
    name: 'West London Citizens',
    type: 'organisation',
    description: 'The Citizens UK chapter organising alliances of schools, faith groups, unions, charities and community organisations across west London, including Ealing Citizens.',
    aliases: ['West London Citizens Alliance'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/the-kings-centre-southall',
    id: 'civic:organisation:the-kings-centre-southall',
    name: 'The Kings Centre Southall',
    type: 'organisation',
    description: 'A Southall training and community hub focused on equipping church and community leaders for social change in a diverse local context.',
    aliases: ["The King's Centre Southall", 'Kings Centre Southall', 'The Kings Centre'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  }
];

export function findCommunityEntityByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return COMMUNITY_ENTITIES.find(entity => entity.route === route) || null;
}
