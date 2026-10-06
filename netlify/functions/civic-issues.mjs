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
    primaryEntityId: issue.primaryEntityId,
    primaryPlaceRoute: issue.primaryPlaceRoute || null
  };
}

export default async request => {
  const url = new URL(request.url);
  const entityId = url.searchParams.get('entityId');
  const issues = entityId ? issuesForProviderEntity(entityId).map(publicIssue) : ISSUE_REGISTRY.map(publicIssue);
  return json({ matched: true, issues, count: issues.length }, 200, 300);
};
