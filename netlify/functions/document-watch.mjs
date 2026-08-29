import { fetchEalingCouncilDocuments } from './ealing-council-documents.mjs';

export default async () => {
  try {
    const result = await fetchEalingCouncilDocuments();
    const items = [...(result.items || [])].sort((a, b) => {
      const ad = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      const bd = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return bd - ad;
    });

    return new Response(JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: result.source,
      items,
      diagnostics: result.diagnostics
    }), {
      status: result.ok ? 200 : 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300, stale-while-revalidate=900',
        'access-control-allow-origin': '*'
      }
    });
  } catch (error) {
    console.error('Document Watch failed', error);
    return new Response(JSON.stringify({ error: 'Document Watch is temporarily unavailable.' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }
};
