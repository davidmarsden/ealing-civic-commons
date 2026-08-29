export const ISSUE_REGISTRY = [
  {
    route: 'issues/southall-gasworks-redevelopment',
    id: 'civic:issue:southall-gasworks-redevelopment',
    name: 'Southall Gasworks redevelopment',
    status: 'ongoing',
    description: 'The long-running redevelopment of the former Southall Gasworks site, including planning, remediation, air-quality, public-health and accountability questions around the scheme.',
    primaryEntityId: 'entity:southall-gasworks',
    entityIds: [
      'entity:southall-gasworks',
      'entity:berkeley-group',
      'entity:ealing-council',
      'entity:environment-agency',
      'entity:public-health-england',
      'entity:greater-london-authority'
    ],
    topicIds: [
      'topic:air-pollution',
      'topic:planning-development',
      'topic:public-health',
      'topic:council-accountability',
      'topic:housing'
    ],
    aliases: ['Southall Gasworks', 'Southall Waterside', 'former Southall Gasworks'],
    providers: [
      { provider: 'civic-commons', role: 'canonical-public-issue' },
      { provider: 'southall-zettel', role: 'reviewed-civic-memory' }
    ]
  }
];

export function normaliseIssueRoute(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
}

export function findIssueByRoute(value) {
  const route = normaliseIssueRoute(value);
  return ISSUE_REGISTRY.find(issue => issue.route === route) || null;
}

export function issuesForProviderEntity(entityId) {
  return ISSUE_REGISTRY.filter(issue => issue.entityIds.includes(entityId)).map(issue => ({
    id: issue.id,
    route: issue.route,
    name: issue.name,
    status: issue.status,
    description: issue.description
  }));
}
