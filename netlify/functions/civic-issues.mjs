import { ISSUE_REGISTRY, issuesForProviderEntity } from '../lib/issue-registry.mjs';

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}

function publicIssue(issue) {
  return {
    id: issue.id,
    route: issue.route,
    name: issue.name,
    status: issue.status,
    maturity: issue.maturity || 'developing',
    description: issue.description,
    primaryEntityId: issue.primaryEntityId || null,
    primaryCivicEntityId: issue.primaryCivicEntityId || null,
    primaryPlaceRoute: issue.primaryPlaceRoute || null,
    ...(typeof issue.isPrimaryForEntity === 'boolean' ? { isPrimaryForEntity: issue.isPrimaryForEntity } : {})
  };
}

export default async request => {
  const url = new URL(request.url);
  const entityId = url.searchParams.get('entityId');
  if (!entityId) {
    const issues = ISSUE_REGISTRY.map(publicIssue);
    return json({ matched: true, issues, count: issues.length }, 200, 300);
  }

  // The entity-specific helper intentionally projects relationship metadata.
  // Rejoin each projection to its canonical registry definition so directory
  // metadata such as maturity is preserved without losing isPrimaryForEntity.
  const issues = issuesForProviderEntity(entityId).map(match => {
    const canonical = ISSUE_REGISTRY.find(issue => issue.id === match.id) || {};
    return publicIssue({ ...canonical, ...match, maturity: canonical.maturity });
  });
  return json({ matched: true, issues, count: issues.length }, 200, 300);
};
