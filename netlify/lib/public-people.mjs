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
  },
  {
    route: 'people/elly-heaton',
    id: 'civic:person:elly-heaton',
    name: 'Elly Heaton',
    type: 'person',
    description: 'Chief executive of the Young Ealing Foundation, a borough-wide youth-sector infrastructure charity supporting grassroots organisations working with children and young people.',
    publicRole: 'Chief Executive Officer, Young Ealing Foundation',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'Young Ealing Foundation — About us', url: 'https://youngealingfoundation.org.uk/about-us/' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/gurpreet-rana',
    id: 'civic:person:gurpreet-rana',
    name: 'Gurpreet Rana',
    type: 'person',
    description: 'Chief executive of Ealing and Hounslow Community Voluntary Service, the voluntary-sector infrastructure organisation supporting community organisations across the two boroughs.',
    publicRole: 'Chief Executive Officer, Ealing and Hounslow Community Voluntary Service',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'Ealing and Hounslow CVS — About', url: 'https://ehcvs.org.uk/about-ealing/' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/mark-poulson',
    id: 'civic:person:mark-poulson',
    name: 'Rev Mark Poulson',
    type: 'person',
    description: 'Convenor of Southall Faiths Forum and a longstanding public interfaith and community-relations representative in Southall and Ealing.',
    publicRole: 'Convenor, Southall Faiths Forum',
    roleStatus: 'current',
    aliases: ['Mark Poulson', 'Revd Mark Poulson', 'Reverend Mark Poulson'],
    website: { label: 'Ealing Race Equality Commission — Mark Poulson', url: 'https://erec.dosomethinggood.org.uk/ealings-race-equality-commission/' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/suresh-grover',
    id: 'civic:person:suresh-grover',
    name: 'Suresh Grover',
    type: 'person',
    description: 'Founder and national coordinator of The Monitoring Group, with a sustained public role in anti-racism, community defence and justice campaigns rooted in Southall and beyond.',
    publicRole: 'Founder and National Coordinator, The Monitoring Group',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'The Monitoring Group — Team', url: 'https://tmg-uk.org/themonitoringgroupteam' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/katie-boyles',
    id: 'civic:person:katie-boyles',
    name: 'Katie Boyles',
    type: 'person',
    description: 'Public organiser of the Warren Farm Nature Reserve campaign and chair of the Brent River and Canal Society, with a sustained civic role in the campaign for Warren Farm and local nature protection.',
    publicRole: 'Warren Farm Nature Reserve campaign organiser and Chair, Brent River and Canal Society',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'Warren Farm Nature Reserve — Campaign', url: 'https://www.warrenfarmnaturereserve.co.uk/campaign-petition' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/denise-colliver',
    id: 'civic:person:denise-colliver',
    name: 'Denise Colliver',
    type: 'person',
    description: 'Co-chair of Stop The Towers in West Ealing, a resident-led campaign group focused on the scale and design of major development in the area.',
    publicRole: 'Co-chair, Stop The Towers in West Ealing',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'Stop The Towers — Who we are', url: 'https://stopthetowers.info/who-is-stop-the-towers' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/justine-sullivan',
    id: 'civic:person:justine-sullivan',
    name: 'Justine Sullivan',
    type: 'person',
    description: 'Co-chair of Stop The Towers in West Ealing, a resident-led campaign group focused on the scale and design of major development in the area.',
    publicRole: 'Co-chair, Stop The Towers in West Ealing',
    roleStatus: 'current',
    aliases: [],
    website: { label: 'Stop The Towers — Who we are', url: 'https://stopthetowers.info/who-is-stop-the-towers' },
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  }
];

export function findPublicPersonByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return PUBLIC_PEOPLE.find(entity => entity.route === route) || null;
}

export function findPublicPersonByProviderId(provider, entityId) {
  return PUBLIC_PEOPLE.find(entity => (entity.providers || []).some(binding => binding.provider === provider && binding.entityId === entityId)) || null;
}
