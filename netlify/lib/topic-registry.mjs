export const TOPIC_REGISTRY = [
  { route: 'topics/air-pollution', id: 'civic:topic:air-pollution', name: 'Air pollution', providerTopicId: 'topic:air-pollution', description: 'Air quality, emissions, odour, monitoring and pollution-related public-health concerns.', aliases: ['air pollution','air quality','emissions','benzene','naphthalene'], feedTopics: ['Environment'] },
  { route: 'topics/children-centres', id: 'civic:topic:children-centres', name: "Children's centres", providerTopicId: 'topic:children-centres', description: "Children's centres, family services and decisions affecting early-years provision.", aliases: ["children's centres",'children centres','childrens centres'], feedTopics: ['Schools & young people'] },
  { route: 'topics/council-accountability', id: 'civic:topic:council-accountability', name: 'Council accountability', providerTopicId: 'topic:council-accountability', description: 'Scrutiny, transparency, complaints, information rights and accountability in local government.', aliases: ['council accountability','accountability','scrutiny','transparency'], feedTopics: ['Council & democracy'] },
  { route: 'topics/governance', id: 'civic:topic:governance', name: 'Governance', providerTopicId: 'topic:governance', description: 'How local decisions are made, who exercises authority, and how civic institutions are governed.', aliases: ['governance','decision-making','council leadership'], feedTopics: ['Council & democracy'] },
  { route: 'topics/housing', id: 'civic:topic:housing', name: 'Housing', providerTopicId: 'topic:housing', description: 'Housing supply, affordability, council housing, temporary accommodation and housing delivery.', aliases: ['housing','affordable homes','council housing','temporary accommodation'], feedTopics: ['Housing'] },
  { route: 'topics/local-democracy', id: 'civic:topic:local-democracy', name: 'Local democracy', providerTopicId: 'topic:local-democracy', description: 'Elections, councillors, petitions, scrutiny and public participation in local decision-making.', aliases: ['local democracy','councillors','petition','scrutiny'], feedTopics: ['Council & democracy'] },
  { route: 'topics/pensions-divestment', id: 'civic:topic:pensions-divestment', name: 'Pensions and divestment', providerTopicId: 'topic:pensions-divestment', description: 'Local-government pension governance, investment and divestment debates.', aliases: ['pension fund','pensions','divestment','divest'], feedTopics: ['Council & democracy'] },
  { route: 'topics/planning-development', id: 'civic:topic:planning-development', name: 'Planning and development', providerTopicId: 'topic:planning-development', description: 'Planning decisions, regeneration, redevelopment and major development across the borough.', aliases: ['planning','development','regeneration','redevelopment'], feedTopics: ['Planning & development'] },
  { route: 'topics/public-health', id: 'civic:topic:public-health', name: 'Public health', providerTopicId: 'topic:public-health', description: 'Population health, health risks and the public-health consequences of civic decisions.', aliases: ['public health','health risk','health risks'], feedTopics: [] },
  { route: 'topics/waste-flytipping', id: 'civic:topic:waste-flytipping', name: 'Waste and fly-tipping', providerTopicId: 'topic:waste-flytipping', description: 'Waste collection, recycling, street cleanliness and fly-tipping.', aliases: ['fly-tipping','fly tipping','waste','recycling'], feedTopics: ['Environment'] }
].map(topic => ({ ...topic, providers: [
  { provider: 'civic-commons', role: 'canonical-public-topic' },
  { provider: 'southall-zettel', topicId: topic.providerTopicId, role: 'reviewed-civic-memory' }
] }));

export function normaliseTopicRoute(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
}

export function findTopicByRoute(value) {
  const route = normaliseTopicRoute(value);
  return TOPIC_REGISTRY.find(topic => topic.route === route) || null;
}

export function findTopicByProviderId(topicId) {
  return TOPIC_REGISTRY.find(topic => topic.providerTopicId === topicId) || null;
}
