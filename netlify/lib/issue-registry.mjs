import issueData from './issues.json' with { type: 'json' };

function freezeIssue(issue) {
  return Object.freeze({
    ...issue,
    entityIds: Object.freeze([...(issue.entityIds || [])]),
    entityRoutes: Object.freeze([...(issue.entityRoutes || [])]),
    topicIds: Object.freeze([...(issue.topicIds || [])]),
    aliases: Object.freeze([...(issue.aliases || [])]),
    planningReferences: Object.freeze([...(issue.planningReferences || [])]),
    providers: Object.freeze([...(issue.providers || [])]),
    evidence: Object.freeze([...(issue.evidence || [])].map(item => Object.freeze({ ...item })))
  });
}

// Issue definitions are reviewed Commons records. A definition may use
// published civic memory, Commons-native evidence, or both. Public routing is
// controlled here rather than by whether a legacy research provider happens to
// contain the issue.
export const ISSUE_DEFINITIONS = Object.freeze(issueData.map(freezeIssue));
export const ISSUE_REGISTRY = ISSUE_DEFINITIONS;

export function normaliseIssueRoute(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
}

function providerStyleId(civicEntityId) {
  const parts = String(civicEntityId || '').split(':');
  const slug = parts.length >= 3 && parts[0] === 'civic' ? parts.slice(2).join(':') : null;
  return slug ? `entity:${slug}` : null;
}

function issueMatchesEntity(issue, entityId) {
  return issue.entityIds.includes(entityId)
    || issue.primaryEntityId === entityId
    || issue.primaryCivicEntityId === entityId
    || providerStyleId(issue.primaryCivicEntityId) === entityId;
}

export function findIssueByRoute(value) {
  const route = normaliseIssueRoute(value);
  return ISSUE_REGISTRY.find(issue => issue.route === route) || null;
}

export function issuesForProviderEntity(entityId) {
  return ISSUE_REGISTRY.filter(issue => issueMatchesEntity(issue, entityId)).map(issue => ({
    id: issue.id,
    route: issue.route,
    name: issue.name,
    status: issue.status,
    description: issue.description,
    primaryEntityId: issue.primaryEntityId || null,
    primaryCivicEntityId: issue.primaryCivicEntityId || null,
    primaryPlaceRoute: issue.primaryPlaceRoute || null,
    isPrimaryForEntity: issue.primaryEntityId === entityId
      || issue.primaryCivicEntityId === entityId
      || providerStyleId(issue.primaryCivicEntityId) === entityId
  }));
}
