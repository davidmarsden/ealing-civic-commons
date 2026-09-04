const BOROUGH_TOWNS = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
const SOURCE = { id: 'modern-gov', name: 'Ealing Council — ModernGov', homepage: 'https://ealing.moderngov.co.uk/', sourceClass: 'Official record' };
const SNAPSHOT_URL = 'https://raw.githubusercontent.com/davidmarsden/ealing-civic-commons/main/public/data/moderngov-whatsnew.json';

function cleanText(value = '') {
  return String(value)
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

function formatDate(date) {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
}

export function listingUrl(now = new Date()) {
  const start = new Date(now);
  const end = new Date(now);
  start.setUTCDate(start.getUTCDate() - 180);
  end.setUTCDate(end.getUTCDate() + 45);
  const range = `${formatDate(start)}-${formatDate(end)}`;
  return `https://ealing.moderngov.co.uk/mgWhatsNew.aspx?ACT=Find&DR=${encodeURIComponent(range)}&XXR=0`;
}

function publishedAt(value) {
  const match = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12)).toISOString() : null;
}

function absoluteUrl(value, base) {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), base);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function destinationLink(block, base) {
  const anchors = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)];
  for (const anchor of anchors) {
    const href = absoluteUrl(anchor[1], base);
    if (!href) continue;
    try {
      const url = new URL(href);
      if (url.hostname !== 'ealing.moderngov.co.uk') continue;
      if (/mg(?:WhatsNew|Rss)\.aspx$/i.test(url.pathname)) continue;
      return href;
    } catch {}
  }
  return base;
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
    .replace(/\bEaling (?:Pension Fund|Pension Fund Panel|Pension Board|Audit and Governance Committee|Cabinet|Council|Health and Wellbeing Board|Scrutiny|Overview and Scrutiny Committee|Standards Committee)\b/gi, ' ');

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

function blockAround(html, index) {
  const candidates = [
    ['<li', '</li>'],
    ['<tr', '</tr>'],
    ['<div', '</div>']
  ];
  let best = null;
  for (const [open, close] of candidates) {
    const start = html.lastIndexOf(open, index);
    if (start < 0) continue;
    const end = html.indexOf(close, index);
    if (end < 0 || end - start > 8000) continue;
    if (!best || start > best.start) best = { start, end: end + close.length };
  }
  return best ? html.slice(best.start, best.end) : html.slice(Math.max(0, index - 400), Math.min(html.length, index + 1800));
}

export function parseItems(html, base) {
  const items = [];
  const seen = new Set();
  const pattern = /(\d{1,2}\/\d{1,2}\/20\d{2})\s*-\s*(Agenda published|Minutes published|Decision sheet published|Issue published|Decision published|ePetition|Publication of plan)\s*:/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const block = blockAround(html, match.index);
    const text = cleanText(block);
    const parsed = text.match(/(\d{1,2}\/\d{1,2}\/20\d{2})\s*-\s*(Agenda published|Minutes published|Decision sheet published|Issue published|Decision published|ePetition|Publication of plan)\s*:\s*(.+)/i);
    if (!parsed) continue;
    const date = publishedAt(parsed[1]);
    const detail = parsed[3].replace(/\s+(?:View|Details|More information|Back to top).*$/i, '').trim();
    if (!date || !detail) continue;
    const eventType = parsed[2].replace(/^epetition$/i, 'ePetition');
    const key = `${parsed[1]}|${eventType.toLowerCase()}|${detail.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const place = placeFor(detail);
    const url = destinationLink(block, base);
    items.push({
      id: `${SOURCE.id}:${key}`,
      sourceId: SOURCE.id,
      source: SOURCE.name,
      sourceClass: SOURCE.sourceClass,
      sourceHomepage: SOURCE.homepage,
      mediaType: null,
      title: `${eventType}: ${detail}`,
      url,
      canonicalUrl: null,
      dedupeKey: `${SOURCE.id}:${key}`,
      summary: `Official ModernGov publication update: ${detail}`.slice(0, 420),
      publishedAt: date,
      towns: place.towns,
      boroughWide: place.boroughWide,
      topics: topicsFor(detail),
      derived: true,
      derivedFrom: 'Ealing ModernGov What’s new public listing',
      aiGenerated: false
    });
  }
  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 30);
}

function snapshotHealth(items, generatedAt) {
  const ageMs = generatedAt ? Date.now() - Date.parse(generatedAt) : NaN;
  const stale = Number.isFinite(ageMs) && ageMs > 36 * 60 * 60 * 1000;
  return {
    ...SOURCE,
    ok: items.length > 0 && !stale,
    status: stale ? 'upstream' : items.length ? 'ok' : 'error',
    error: stale ? 'GitHub snapshot is older than 36 hours' : items.length ? null : 'GitHub snapshot contains no supported updates',
    itemCount: items.length,
    diagnostics: [{ mode: 'github-actions-snapshot', outcome: 'snapshot', generatedAt: generatedAt || null }]
  };
}

async function fetchSnapshot() {
  try {
    const response = await fetch(SNAPSHOT_URL, { headers: { accept: 'application/json' }, redirect: 'follow' });
    if (!response.ok) return null;
    const snapshot = await response.json();
    if (!snapshot || !Array.isArray(snapshot.items)) return null;
    return { items: snapshot.items, health: [snapshotHealth(snapshot.items, snapshot.generatedAt)] };
  } catch {
    return null;
  }
}

export async function fetchModernGovWhatsNew() {
  const snapshot = await fetchSnapshot();
  if (snapshot?.items?.length) return snapshot;

  const url = listingUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'user-agent': 'Ealing-Civic-Commons/1.0' }
    });
    const diagnostics = [{ mode: 'public-html-fallback', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }];
    if (!response.ok) {
      const blocked = [401, 403, 406, 429].includes(response.status);
      return { items: [], health: [{ ...SOURCE, ok: false, status: blocked ? 'blocked' : 'error', error: `HTTP ${response.status}; GitHub snapshot unavailable`, itemCount: 0, diagnostics }] };
    }
    const items = parseItems(await response.text(), response.url || url);
    return { items, health: [{ ...SOURCE, ok: true, status: 'ok', error: items.length ? null : 'No supported publication updates found', itemCount: items.length, diagnostics }] };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return { items: [], health: [{ ...SOURCE, ok: false, status: 'upstream', error: `${message}; GitHub snapshot unavailable`, itemCount: 0, diagnostics: [{ mode: 'public-html-fallback', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] }] };
  } finally {
    clearTimeout(timer);
  }
}
