import civicItem from './civic-item.mjs';
import civicEntity from './civic-entity.mjs';

const SITE_NAME = 'Southall & Ealing Civic Commons';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function compact(value, max = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function canonicalOrigin(request) {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

function internalRequest(url, request) {
  return new Request(url.toString(), { method: 'GET', headers: request.headers });
}

async function metadata(request, kind, path) {
  if (kind === 'item') {
    const apiUrl = new URL(request.url);
    apiUrl.search = '';
    apiUrl.searchParams.set('key', path);
    const response = await civicItem(internalRequest(apiUrl, request));
    if (!response.ok) return null;
    const data = await response.json();
    const item = data?.item;
    if (!item?.title) return null;
    return {
      title: item.title,
      description: compact(item.summary || `Local civic information from ${item.source || 'a Civic Commons source'}.`),
      type: 'article'
    };
  }

  if (kind === 'entity') {
    const route = path.replace(/^\/+/, '');
    const apiUrl = new URL(request.url);
    apiUrl.search = '';
    apiUrl.searchParams.set('route', route);
    const response = await civicEntity(internalRequest(apiUrl, request));
    if (!response.ok) return null;
    const data = await response.json();
    const entity = data?.entity;
    if (!data?.matched || !entity?.name) return null;
    const fallback = entity.type === 'person'
      ? 'A person in the reviewed Civic Commons civic-memory graph.'
      : entity.type === 'organisation'
        ? 'An organisation in the reviewed Civic Commons civic-memory graph.'
        : 'A place in the reviewed Civic Commons civic-memory graph.';
    return { title: entity.name, description: compact(entity.description || fallback), type: 'website' };
  }

  return null;
}

function inject(html, meta, canonical, imageUrl) {
  if (!meta) return html;
  const fullTitle = `${meta.title} — Civic Commons`;
  const tags = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
    `<meta property="og:type" content="${esc(meta.type)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(imageUrl)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="Southall &amp; Ealing Civic Commons" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(imageUrl)}" />`,
    '<meta name="twitter:image:alt" content="Southall &amp; Ealing Civic Commons" />'
  ].join('\n  ');

  return html
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(fullTitle)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${esc(meta.description)}" />`)
    .replace('</head>', `  ${tags}\n</head>`);
}

export default async request => {
  const url = new URL(request.url);
  const kind = String(url.searchParams.get('kind') || '').trim();
  const path = String(url.searchParams.get('path') || '').trim();
  const shell = kind === 'item' ? '/item.html' : kind === 'entity' ? '/entity.html' : null;
  if (!shell || !path) return new Response('Not found', { status: 404 });

  const shellUrl = new URL(shell, request.url);
  shellUrl.search = '';
  const shellResponse = await fetch(shellUrl, { headers: { accept: 'text/html' } });
  if (!shellResponse.ok) return new Response('Page shell unavailable', { status: 503 });

  const route = kind === 'item' ? `/items/${path}` : `/${path.replace(/^\/+/, '')}`;
  const origin = canonicalOrigin(request);
  const canonical = `${origin}${route}`;
  const imageUrl = `${origin}/.netlify/images?url=/og-image.svg&w=1200&h=630&fit=cover&fm=png`;
  let meta = null;
  try { meta = await metadata(request, kind, path); }
  catch (error) { console.error('Social metadata lookup failed', error); }

  const body = inject(await shellResponse.text(), meta, canonical, imageUrl);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=1800',
      'x-frame-options': 'DENY',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()'
    }
  });
};
