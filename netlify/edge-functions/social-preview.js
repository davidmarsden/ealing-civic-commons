const SOCIAL_CRAWLER = /(?:facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|pinterestbot|skypeuripreview|vkshare|mastodon|bluesky|bsky|cardyb|embedly|quora link preview|outbrain|rogerbot|showyoubot)/i;
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

  const userAgent = request.headers.get('user-agent') || '';
  if (!SOCIAL_CRAWLER.test(userAgent)) return context.next();

  const meta = routeMetadata(url.pathname);
  if (!meta) return context.next();

  const previewUrl = new URL('/.netlify/functions/social-page', url.origin);
  previewUrl.searchParams.set('kind', meta.kind);
  previewUrl.searchParams.set('path', meta.path);

  const response = await fetch(previewUrl, {
    headers: {
      accept: 'text/html',
      'user-agent': userAgent,
      'x-forwarded-host': url.host,
      'x-forwarded-proto': url.protocol.replace(':', '')
    }
  });

  if (!response.ok) return context.next();
  return response;
};

export const config = {
  path: ['/', '/items/*', '/people/*', '/organisations/*', '/places/*']
};
