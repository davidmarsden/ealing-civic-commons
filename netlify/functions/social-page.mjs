import civicItem from './civic-item.mjs';
import civicEntity from './civic-entity.mjs';

const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const TOWN_IMAGE = {
  Ealing: 'ealing-town',
  Acton: 'acton',
  Greenford: 'greenford',
  Hanwell: 'hanwell',
  Northolt: 'northolt',
  Perivale: 'perivale',
  Southall: 'southall'
};

const identity = {
  siteName: 'Ealing Civic Commons',
  imageAlt: 'Ealing Civic Commons',
  imageKey: 'ealing'
};

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
  if (String(host).toLowerCase() === 'commons.southallstories.uk') return 'https://ealing.civiccommons.co.uk';
  return `${proto}://${host}`;
}

function explicitTownsFromText(item) {
  const haystack = `${item?.title || ''} ${item?.summary || ''}`
    .replace(/\b(?:the\s+)?London Borough of Ealing(?: Council)?\b/gi, ' ')
    .replace(/\bEaling Council\b/gi, ' ')
    .replace(/\bEaling LBC\b/gi, ' ')
    .replace(/\bEaling and Hillingdon\b/gi, ' ')
    .replace(/\bEaling Citizens\b/gi, ' ');

  const towns = BOROUGH_TOWNS.filter(town => town !== 'Ealing' && new RegExp(`\\b${town}\\b`, 'i').test(haystack));
  const ealingTown = /\b(?:Ealing town|Ealing Broadway|West Ealing|Ealing Common|Ealing Green|Northfields?)\b/i.test(haystack);
  if (ealingTown) towns.unshift('Ealing');
  return towns;
}

function itemPlaceScope(item) {
  const assigned = Array.isArray(item?.towns) ? item.towns.filter(town => BOROUGH_TOWNS.includes(town)) : [];
  const explicit = explicitTownsFromText(item);
  if (explicit.length) return { boroughWide: false, towns: explicit };

  const sourceLooksBoroughWide = item?.boroughWide === true || BOROUGH_TOWNS.every(town => assigned.includes(town));
  if (sourceLooksBoroughWide) return { boroughWide: true, towns: [] };
  return { boroughWide: false, towns: assigned };
}

function townIdentity(towns, boroughWide = false) {
  if (boroughWide || !Array.isArray(towns) || towns.length !== 1) return identity;
  const town = towns[0];
  const imageKey = TOWN_IMAGE[town];
  if (!imageKey) return identity;
  const placeName = town === 'Ealing' ? 'Ealing town' : town;
  return {
    ...identity,
    imageKey,
    imageAlt: `${placeName} Civic Commons — What’s happening to ${placeName}?`
  };
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
    const place = itemPlaceScope(item);
    return {
      title: item.title,
      description: compact(item.summary || `Local civic information from ${item.source || 'a Civic Commons source'}.`),
      type: 'article',
      socialIdentity: townIdentity(place.towns, place.boroughWide)
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
    const socialIdentity = entity.type === 'place' && BOROUGH_TOWNS.includes(entity.name)
      ? townIdentity([entity.name], false)
      : identity;
    return { title: entity.name, description: compact(entity.description || fallback), type: 'website', socialIdentity };
  }

  return null;
}

function inject(html, meta, canonical, imageUrl, socialIdentity) {
  if (!meta) return html;
  const fullTitle = `${meta.title} — ${identity.siteName}`;
  const tags = [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<meta property="og:site_name" content="${esc(identity.siteName)}" />`,
    `<meta property="og:type" content="${esc(meta.type)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:image" content="${esc(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${esc(imageUrl)}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(socialIdentity.imageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${esc(socialIdentity.imageAlt)}" />`
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
  let meta = null;
  try { meta = await metadata(request, kind, path); }
  catch (error) { console.error('Social metadata lookup failed', error); }

  const socialIdentity = meta?.socialIdentity || identity;
  const imageUrl = `${origin}/brand/social/${socialIdentity.imageKey}.jpg`;
  const body = inject(await shellResponse.text(), meta, canonical, imageUrl, socialIdentity);
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
