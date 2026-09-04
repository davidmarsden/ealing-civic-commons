const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const SOURCE = {
  id: 'modern-gov',
  name: 'Ealing Council — ModernGov',
  homepage: 'https://ealing.moderngov.co.uk/',
  sourceClass: 'Official record'
};
const MODERNGOV_RSS = 'https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0';
// Ealing's Cloudflare policy blocks Netlify/GitHub server IPs from reading the
// otherwise public ModernGov RSS endpoint. rss2json is used only as a transport
// bridge: item titles, publication dates and canonical ModernGov click-through
// links remain those published by Ealing ModernGov.
const RSS_BRIDGE = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(MODERNGOV_RSS)}&count=50`;
const SUPPORTED_EVENT = /^(Agenda published|Minutes published|Decision sheet published|Issue published|Decision published|ePetition|Publication of plan)\s*:\s*(.+)$/i;

function cleanText(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normaliseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}\s/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function safeModernGovUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'ealing.moderngov.co.uk' && /^https?:$/.test(url.protocol)
      ? url.toString()
      : SOURCE.homepage;
  } catch {
    return SOURCE.homepage;
  }
}

function topicsFor(text) {
  const value = String(text).toLowerCase();
  const topics = [];
  const add = topic => { if (!topics.includes(topic)) topics.push(topic); };
  if (/planning|development|application|regeneration|construction/.test(value)) add('Planning & development');
  if (/housing|tenant|rent|homeless|temporary accommodation/.test(value)) add('Housing');
  if (/air quality|pollution|climate|park|tree|environment|recycling|waste/.test(value)) add('Environment');
  if (/traffic|transport|bus|rail|road|parking|cycle|street/.test(value)) add('Transport');
  if (/school|children|young people|youth|education|nursery/.test(value)) add('Schools & young people');
  if (/police|crime|safety|licensing|anti-social|antisocial/.test(value)) add('Policing & safety');
  if (/heritage|arts|culture|museum|conservation/.test(value)) add('Culture & history');
  add('Council & democracy');
  return topics.slice(0, 3);
}

function placeFor(text) {
  const value = String(text)
    .replace(/\bLondon Borough of Ealing(?: Council)?\b/gi, ' ')
    .replace(/\bEaling Council\b/gi, ' ')
    .replace(/\bEaling (?:Pension Fund|Pension Fund Panel|Pension Board|Audit and Governance Committee|Audit Committee|Cabinet|Council|Health and Wellbeing Board|Schools Forum|Safer Neighbourhood Board|Scrutiny|Overview and Scrutiny Committee|Standards Committee)\b/gi, ' ');

  const explicitTownPatterns = {
    Ealing: /\b(?:Ealing Broadway|Ealing town|central Ealing|West Ealing|North Ealing|South Ealing)\b/i,
    Acton: /\bActon\b/i,
    Greenford: /\bGreenford\b/i,
    Hanwell: /\bHanwell\b/i,
    Northolt: /\bNortholt\b/i,
    Perivale: /\bPerivale\b/i,
    Southall: /\bSouthall\b/i
  };

  const towns = BOROUGH_TOWNS.filter(town => explicitTownPatterns[town].test(value));
  return { towns: towns.length ? towns : BOROUGH_TOWNS, boroughWide: towns.length === 0 };
}

function normaliseBridgeItem(entry) {
  const rawTitle = cleanText(entry?.title || entry?.description || entry?.content || '');
  const match = rawTitle.match(SUPPORTED_EVENT);
  if (!match) return null;

  const eventType = match[1].replace(/^epetition$/i, 'ePetition');
  const detail = cleanText(match[2]);
  const publishedAt = normaliseDate(entry?.pubDate);
  if (!detail || !publishedAt) return null;

  const place = placeFor(detail);
  const identity = cleanText(entry?.guid || `${entry?.pubDate || ''}|${eventType}|${detail}`);
  const url = safeModernGovUrl(entry?.link || SOURCE.homepage);

  return {
    id: `${SOURCE.id}:${identity}`,
    sourceId: SOURCE.id,
    source: SOURCE.name,
    sourceClass: SOURCE.sourceClass,
    sourceHomepage: SOURCE.homepage,
    mediaType: null,
    title: `${eventType}: ${detail}`,
    url,
    // ModernGov commonly reuses the same destination page for separate
    // publication events (for example agenda + minutes). Keep event identity
    // separate from the destination URL so the combined-feed deduper does not
    // collapse distinct official updates.
    canonicalUrl: null,
    dedupeKey: `${SOURCE.id}:${identity}`,
    summary: `Official ModernGov publication update: ${detail}`.slice(0, 420),
    publishedAt,
    towns: place.towns,
    boroughWide: place.boroughWide,
    topics: topicsFor(detail),
    derived: true,
    derivedFrom: 'Ealing ModernGov RSS via public RSS reader bridge',
    aiGenerated: false
  };
}

async function fetchViaRssBridge() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const started = Date.now();
  try {
    const response = await fetch(RSS_BRIDGE, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'application/json', 'user-agent': 'Ealing-Civic-Commons/1.0' }
    });
    const diagnostics = [{
      mode: 'rss-reader-bridge',
      outcome: 'http-response',
      httpStatus: response.status,
      elapsedMs: Date.now() - started
    }];

    if (!response.ok) {
      return { items: [], health: [{ ...SOURCE, ok: false, status: 'upstream', error: `RSS reader bridge HTTP ${response.status}`, itemCount: 0, diagnostics }] };
    }

    const data = await response.json();
    if (data?.status !== 'ok' || !Array.isArray(data?.items)) {
      const message = cleanText(data?.message || 'RSS reader bridge returned an invalid response');
      return { items: [], health: [{ ...SOURCE, ok: false, status: 'upstream', error: message, itemCount: 0, diagnostics }] };
    }

    const items = data.items.map(normaliseBridgeItem).filter(Boolean);
    return {
      items,
      health: [{
        ...SOURCE,
        ok: items.length > 0,
        status: items.length ? 'ok' : 'error',
        error: items.length ? null : 'ModernGov feed responded but contained no supported publication updates',
        itemCount: items.length,
        diagnostics
      }]
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'RSS reader bridge timed out' : String(error?.message || error);
    return {
      items: [],
      health: [{
        ...SOURCE,
        ok: false,
        status: 'upstream',
        error: message,
        itemCount: 0,
        diagnostics: [{ mode: 'rss-reader-bridge', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }]
      }]
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchModernGovWhatsNew() {
  return fetchViaRssBridge();
}
