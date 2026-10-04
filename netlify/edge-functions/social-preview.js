const LEGACY_HOST = 'commons.southallstories.uk';
const CANONICAL_ORIGIN = 'https://ealing.civiccommons.co.uk';

function routeMetadata(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'items' && parts.length > 1) {
    return { kind: 'item', path: parts.slice(1).join('/') };
  }
  if (['people', 'organisations', 'places'].includes(parts[0]) && parts.length > 1) {
    return { kind: 'entity', path: parts.join('/') };
  }
  return null;
}

function legacyDestination(url) {
  if (url.pathname === '/' && !url.search) return `${CANONICAL_ORIGIN}/?town=Southall`;
  return `${CANONICAL_ORIGIN}${url.pathname}${url.search}`;
}

export default async (request, context) => {
  if (!['GET', 'HEAD'].includes(request.method)) return context.next();

  const url = new URL(request.url);
  if (url.hostname.toLowerCase() === LEGACY_HOST) {
    return Response.redirect(legacyDestination(url), 302);
  }

  const meta = routeMetadata(url.pathname);
  if (!meta) return context.next();

  // Item/entity pages are client-rendered, so their static shells cannot expose
  // item-specific Open Graph metadata. Always serve the metadata-enriched shell,
  // not just for a crawler allow-list. This makes previews work for crawlers with
  // unfamiliar user agents and keeps canonical/title/description useful to normal
  // clients and search engines too.
  const previewUrl = new URL('/.netlify/functions/social-page', url.origin);
  previewUrl.searchParams.set('kind', meta.kind);
  previewUrl.searchParams.set('path', meta.path);

  const response = await fetch(previewUrl, {
    headers: {
      accept: 'text/html',
      'user-agent': request.headers.get('user-agent') || '',
      'x-forwarded-host': url.host,
      'x-forwarded-proto': url.protocol.replace(':', '')
    }
  });

  if (!response.ok) return context.next();
  if (request.method === 'HEAD') {
    return new Response(null, { status: response.status, headers: response.headers });
  }
  return response;
};

export const config = {
  path: ['/', '/items/*', '/people/*', '/organisations/*', '/places/*'],
  onError: 'bypass'
};
