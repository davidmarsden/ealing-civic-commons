import issueData from './issues.json' with { type: 'json' };

export const ISSUE_REGISTRY = Object.freeze(issueData.map(issue => Object.freeze({
  ...issue,
  entityIds: Object.freeze([...(issue.entityIds || [])]),
  topicIds: Object.freeze([...(issue.topicIds || [])]),
  aliases: Object.freeze([...(issue.aliases || [])]),
  providers: Object.freeze([...(issue.providers || [])])
})));

export function normaliseIssueRoute(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
}

export function findIssueByRoute(value) {
  const route = normaliseIssueRoute(value);
  return ISSUE_REGISTRY.find(issue => issue.route === route) || null;
}

export function issuesForProviderEntity(entityId) {
  return ISSUE_REGISTRY.filter(issue => issue.entityIds.includes(entityId) || issue.primaryCivicEntityId === entityId).map(issue => ({
    id: issue.id,
    route: issue.route,
    name: issue.name,
    status: issue.status,
    description: issue.description,
    primaryEntityId: issue.primaryEntityId || null,
    primaryCivicEntityId: issue.primaryCivicEntityId || null,
    primaryPlaceRoute: issue.primaryPlaceRoute || null,
    isPrimaryForEntity: issue.primaryEntityId === entityId || issue.primaryCivicEntityId === entityId
  }));
}
