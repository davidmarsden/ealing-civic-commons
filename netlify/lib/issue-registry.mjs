import issueData from './issues.json' with { type: 'json' };

function freezeIssue(issue) {
  return Object.freeze({
    ...issue,
    entityIds: Object.freeze([...(issue.entityIds || [])]),
    topicIds: Object.freeze([...(issue.topicIds || [])]),
    aliases: Object.freeze([...(issue.aliases || [])]),
    providers: Object.freeze([...(issue.providers || [])])
  });
}

// All reviewed definitions, including Commons-native candidates that are not yet
// safe to expose through the legacy Zettel-only issue assembler.
export const ISSUE_DEFINITIONS = Object.freeze(issueData.map(freezeIssue));

// Until civic-issue.mjs can assemble issue-specific Commons evidence, only
// definitions with the established published-memory provider enter live routes
// and entity backlinks. This prevents generic council relationships/sources from
// being misrepresented as evidence for a newly defined issue.
export const ISSUE_REGISTRY = Object.freeze(ISSUE_DEFINITIONS.filter(issue =>
  issue.providers.some(binding => binding.provider === 'southall-zettel')
));

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
