export const INSTITUTIONAL_ENTITIES = [
  {
    route: 'organisations/west-london-waste-authority',
    id: 'civic:organisation:west-london-waste-authority',
    name: 'West London Waste Authority',
    type: 'organisation',
    description: 'The statutory waste disposal authority serving six west London boroughs, including Ealing.',
    aliases: ['WLWA'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/old-oak-and-park-royal-development-corporation',
    id: 'civic:organisation:old-oak-and-park-royal-development-corporation',
    name: 'Old Oak and Park Royal Development Corporation',
    type: 'organisation',
    description: 'The mayoral development corporation responsible for regeneration and planning functions across Old Oak and Park Royal.',
    aliases: ['OPDC'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/opdc-development-investment-and-sustainability-committee',
    id: 'civic:organisation:opdc-development-investment-and-sustainability-committee',
    name: 'OPDC Development, Investment and Sustainability Committee',
    type: 'organisation',
    description: 'An OPDC committee overseeing development, investment and sustainability decisions.',
    aliases: ['OPDC Development, Investment and Sustainability Committee'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/ealing-pension-fund-panel',
    id: 'civic:organisation:ealing-pension-fund-panel',
    name: 'Ealing Pension Fund Panel',
    type: 'organisation',
    description: 'The Ealing Council body responsible for administering and overseeing the London Borough of Ealing Pension Fund.',
    aliases: ['Pension Fund Panel', 'PFP'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/ealing-pension-fund',
    id: 'civic:organisation:ealing-pension-fund',
    name: 'London Borough of Ealing Pension Fund',
    type: 'organisation',
    description: 'The Local Government Pension Scheme fund administered by Ealing Council for eligible employees, former employees and other participating employers.',
    aliases: ['Ealing Pension Fund', 'London Borough of Ealing Pension Fund'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/london-civ',
    id: 'civic:organisation:london-civ',
    name: 'London CIV',
    type: 'organisation',
    description: 'The Local Government Pension Scheme asset-pooling company that manages investments for London local-authority Partner Funds and Buckinghamshire Council.',
    aliases: ['London LGPS CIV', 'London LGPS CIV Limited'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/london-councils',
    id: 'civic:organisation:london-councils',
    name: 'London Councils',
    type: 'organisation',
    description: 'The cross-party collective of London local government, bringing together the 32 London boroughs and the City of London Corporation.',
    aliases: [],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'organisations/london-councils-leaders-committee',
    id: 'civic:organisation:london-councils-leaders-committee',
    name: "London Councils Leaders' Committee",
    type: 'organisation',
    description: 'London Councils’ main decision-making committee, made up of the leaders or directly elected mayors of London boroughs and the City of London.',
    aliases: ["Leaders' Committee", 'London Councils Leaders Committee'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/ian-kingston',
    id: 'civic:person:ian-kingston',
    name: 'Ian Kingston',
    type: 'person',
    description: 'Ealing councillor and Chair of the Ealing Pension Fund Panel for 2026/27.',
    aliases: ['Cllr Ian Kingston'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  },
  {
    route: 'people/yvonne-johnson',
    id: 'civic:person:yvonne-johnson',
    name: 'Yvonne Johnson',
    type: 'person',
    description: 'Ealing councillor and Vice-Chair of the Ealing Pension Fund Panel for 2026/27.',
    aliases: ['Cllr Yvonne Johnson'],
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  }
];

export function findInstitutionalEntityByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return INSTITUTIONAL_ENTITIES.find(entity => entity.route === route) || null;
}
