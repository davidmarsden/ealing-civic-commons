import { parseEntityRoute } from '../lib/entity-registry.mjs';
import { commonsAssertionsForEntity, commonsSourcesForEntity } from '../lib/reviewed-assertions.mjs';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=1800',
      'access-control-allow-origin': '*'
    }
  });
}

export default async request => {
  const url = new URL(request.url);
  const parsed = parseEntityRoute(url.searchParams.get('route'));
  if (!parsed) return json({ matched: false, reason: 'invalid-entity-route' }, 400);

  const civicEntityId = `civic:${parsed.type}:${parsed.slug}`;
  const assertions = commonsAssertionsForEntity(civicEntityId);
  const sources = commonsSourcesForEntity(civicEntityId);

  return json({
    matched: true,
    schemaVersion: 1,
    civicEntityId,
    provider: {
      id: 'civic-commons',
      name: 'Civic Commons',
      role: 'Reviewed Commons-native curation'
    },
    counts: { assertions: assertions.length, sources: sources.length },
    assertions,
    sources,
    provenance: {
      label: 'Commons-reviewed assertions',
      method: 'Human-reviewed assertions stored by Civic Commons with explicit external evidence. These are independent of Southall-Zettel.'
    }
  });
};
