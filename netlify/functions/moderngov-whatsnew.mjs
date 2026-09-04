const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const SOURCE = {
  id: 'modern-gov',
  name: 'Ealing Council — ModernGov',
  homepage: 'https://ealing.moderngov.co.uk/',
  sourceClass: 'Official record'
};
const MODERNGOV_RSS = 'https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0';
const MODERNGOV_WHATS_NEW = 'https://ealing.moderngov.co.uk/mgWhatsNew.aspx';
const PUBLIC_EPETITIONS = 'https://ealing.moderngov.co.uk/mgEPetitionListDisplay.aspx?bcr=1';
// Ealing's Cloudflare policy blocks Netlify/GitHub server IPs from reading the
// otherwise public ModernGov RSS endpoint. rss2json is used only as a transport
// bridge: item titles, publication dates and ModernGov click-through links
// remain those published by Ealing ModernGov.
// Keep this request to the bridge's basic/free-compatible form. The live probe
// succeeded without an explicit count parameter; requesting larger counts can
// return HTTP 422 on the public endpoint.
const RSS_BRIDGE = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(MODERNGOV_RSS)}`;
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
    const url = new URL(value, SOURCE.homepage);
    return url.hostname === 'ealing.moderngov.co.uk' && /^https?:$/.test(url.protocol)
      ? url.toString()
      : SOURCE.homepage;
  } catch {
    return SOURCE.homepage;
  }
}

function publicModernGovUrl(value, eventType) {
  const safe = safeModernGovUrl(value);
  if (eventType !== 'ePetition') return safe;

  try {
    const url = new URL(safe);
    if (/\/mgIssueHistoryHome\.aspx$/i.test(url.pathname) && url.searchParams.get('EVT') === '54') {
      return PUBLIC_EPETITIONS;
    }
  } catch {}

  return safe;
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
  const url = publicModernGovUrl(entry?.link || SOURCE.homepage, eventType);

  return {
    id: `${SOURCE.id}:${identity}`,
    sourceId: SOURCE.id,
    source: SOURCE.name,
    sourceClass: SOURCE.sourceClass,
    sourceHomepage: SOURCE.homepage,
    mediaType: null,
    title: `${eventType}: ${detail}`,
    url,
    canonicalUrl: null,
    dedupeKey: `${SOURCE.id}:${identity}`,
    summary: `Official ModernGov publication update: ${detail}`.slice(0, 420),
    publishedAt,
    towns: place.towns,
    boroughWide: place.boroughWide,
    topics: topicsFor(detail),
    derived: true,
    derivedFrom: 'Imported from Ealing Council’s ModernGov feed',
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
    const diagnostics = [{ mode: 'rss-reader-bridge', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }];

    if (!response.ok) return { items: [], error: `RSS reader bridge HTTP ${response.status}`, diagnostics };
    const data = await response.json();
    if (data?.status !== 'ok' || !Array.isArray(data?.items)) {
      return { items: [], error: cleanText(data?.message || 'RSS reader bridge returned an invalid response'), diagnostics };
    }

    const items = data.items.map(normaliseBridgeItem).filter(Boolean);
    return { items, error: items.length ? null : 'ModernGov feed responded but contained no supported publication updates', diagnostics };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'RSS reader bridge timed out' : String(error?.message || error);
    return { items: [], error: message, diagnostics: [{ mode: 'rss-reader-bridge', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] };
  } finally {
    clearTimeout(timer);
  }
}

function ukDateToIso(value = '') {
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  if (!match) return null;
  return normaliseDate(`${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}T12:00:00Z`);
}

function recentWhatsNewUrl() {
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 24 * 60 * 60 * 1000);
  const fmt = date => `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  const params = new URLSearchParams({ ACT: 'Find', DR: `${fmt(start)}-${fmt(end)}`, XXR: '0' });
  return `${MODERNGOV_WHATS_NEW}?${params.toString()}`;
}

function parseWhatsNewHtml(html = '') {
  const items = [];
  const liRx = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = liRx.exec(html))) {
    const text = cleanText(match[1]);
    const eventMatch = text.match(/^(\d{1,2}\/\d{1,2}\/20\d{2})\s*-\s*(Agenda published|Minutes published|Decision sheet published|Issue published|Decision published|ePetition|Publication of plan)\s*:\s*(.+)$/i);
    if (!eventMatch) continue;
    const publishedAt = ukDateToIso(eventMatch[1]);
    if (!publishedAt) continue;
    const eventType = eventMatch[2].replace(/^epetition$/i, 'ePetition');
    const detail = cleanText(eventMatch[3]);
    const hrefMatch = match[1].match(/<a\b[^>]*href=["']([^"']+)["']/i);
    const link = hrefMatch ? safeModernGovUrl(hrefMatch[1]) : SOURCE.homepage;
    const item = normaliseBridgeItem({
      title: `${eventType}: ${detail}`,
      pubDate: publishedAt,
      link,
      guid: `${publishedAt}|${eventType}|${detail}`
    });
    if (item) {
      item.derivedFrom = 'Imported from Ealing Council’s public ModernGov What’s New page';
      items.push(item);
    }
  }
  return items;
}

async function fetchViaOfficialHtml() {
  const url = recentWhatsNewUrl();
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
      }
    });
    const diagnostics = [{ mode: 'official-whats-new-fallback', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }];
    if (!response.ok) return { items: [], error: `Official What’s New page HTTP ${response.status}`, diagnostics };
    const items = parseWhatsNewHtml(await response.text());
    return { items, error: items.length ? null : 'Official What’s New page responded but no supported publication updates were parsed', diagnostics };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Official What’s New fallback timed out' : String(error?.message || error);
    return { items: [], error: message, diagnostics: [{ mode: 'official-whats-new-fallback', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchModernGovWhatsNew() {
  const bridge = await fetchViaRssBridge();
  if (bridge.items.length) {
    return { items: bridge.items, health: [{ ...SOURCE, ok: true, status: 'ok', error: null, itemCount: bridge.items.length, diagnostics: bridge.diagnostics }] };
  }

  const fallback = await fetchViaOfficialHtml();
  const diagnostics = [...(bridge.diagnostics || []), ...(fallback.diagnostics || [])];
  if (fallback.items.length) {
    return { items: fallback.items, health: [{ ...SOURCE, ok: true, status: 'ok', error: null, itemCount: fallback.items.length, diagnostics }] };
  }

  return {
    items: [],
    health: [{ ...SOURCE, ok: false, status: 'upstream', error: `${bridge.error || 'RSS bridge unavailable'}; ${fallback.error || 'official fallback unavailable'}`, itemCount: 0, diagnostics }]
  };
}