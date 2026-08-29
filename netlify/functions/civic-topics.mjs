import { TOPIC_REGISTRY } from '../lib/topic-registry.mjs';

function json(body, status = 200, maxAge = 300) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}, stale-while-revalidate=1800`, 'access-control-allow-origin': '*' } });
}

export default async () => json({ matched: true, topics: TOPIC_REGISTRY.map(topic => ({ id: topic.id, route: topic.route, name: topic.name, description: topic.description, providerTopicId: topic.providerTopicId })) });
