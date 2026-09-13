const TOWNS = {
  Acton: { slug: 'acton', label: 'Acton' },
  Ealing: { slug: 'ealing-town', label: 'Ealing town' },
  Greenford: { slug: 'greenford', label: 'Greenford' },
  Hanwell: { slug: 'hanwell', label: 'Hanwell' },
  Northolt: { slug: 'northolt', label: 'Northolt' },
  Perivale: { slug: 'perivale', label: 'Perivale' },
  Southall: { slug: 'southall', label: 'Southall' }
};

const BOROUGH = {
  slug: 'ealing',
  label: 'Ealing',
  title: 'Ealing Civic Commons',
  description: 'Local reporting, community voices and official democratic records connected across the London Borough of Ealing.'
};

function isEalingHost(hostname) {
  const host = hostname.toLowerCase();
  return host === 'ealing.civiccommons.co.uk'
    || host === 'ealing-civic-commons.netlify.app'
    || host.endsWith('--ealing-civic-commons.netlify.app');
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function metadataFor(url) {
  const requestedTown = url.searchParams.get('town');
  const town = TOWNS[requestedTown];
  if (!town) return BOROUGH;

  return {
    ...town,
    title: `${town.label === 'Ealing town' ? 'Ealing' : town.label} Civic Commons`,
    description: `What’s happening to ${town.label}? Local reporting, community voices and official democratic records connected in one civic commons.`
  };
}

function socialTags(meta, url) {
  const canonical = new URL('/', url.origin);
  const requestedTown = url.searchParams.get('town');
  if (TOWNS[requestedTown]) canonical.searchParams.set('town', requestedTown);
  const image = new URL(`/brand/social/${meta.slug}.jpg`, url.origin);

  const title = escapeAttribute(meta.title);
  const description = escapeAttribute(meta.description);
  const canonicalUrl = escapeAttribute(canonical.href);
  const imageUrl = escapeAttribute(image.href);

  return [
    `<link rel="canonical" href="${canonicalUrl}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:image" content="${imageUrl}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${imageUrl}" />`
  ].join('\n  ');
}

export default async (request, context) => {
  if (request.method !== 'GET') return context.next();

  const url = new URL(request.url);
  if (!isEalingHost(url.hostname) || url.pathname !== '/') {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const meta = metadataFor(url);
  const tags = socialTags(meta, url);
  const rewritten = html.replace('</head>', `  ${tags}\n</head>`);

  const headers = new Headers(response.headers);
  headers.delete('content-length');
  const vary = headers.get('vary');
  headers.set('vary', vary ? `${vary}, Host` : 'Host');

  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

export const config = {
  path: '/',
  onError: 'bypass'
};
