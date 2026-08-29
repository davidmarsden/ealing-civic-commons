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
  }
];

export function findInstitutionalEntityByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return INSTITUTIONAL_ENTITIES.find(entity => entity.route === route) || null;
}
