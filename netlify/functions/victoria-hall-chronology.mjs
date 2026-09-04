const SOURCE = {
  id: 'friends-victoria-hall-chronology',
  name: 'Friends of the Victoria Hall — Chronology',
  homepage: 'https://savethevictoriahall.weebly.com/',
  url: 'https://savethevictoriahall.weebly.com/chronology.html',
  sourceClass: 'Organisation / campaign'
};

const MONTH = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const DATE_RX = new RegExp(`(^|\\n)\\s*(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\s*(?=\\n|$)`, 'gim');

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&#8203;|&ZeroWidthSpace;/gi, '');
}

function htmlToText(html = '') {
  return decodeEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isoDate(day, month, year) {
  const timestamp = Date.parse(`${day} ${month} ${year}`);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function summaryTitle(text = '') {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const sentence = clean.match(/^(.{20,180}?[.!?])(?:\s|$)/)?.[1] || clean.slice(0, 155);
  return sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence;
}

function topics(text = '') {
  const value = String(text).toLowerCase();
  const out = ['Council & democracy', 'Culture & history'];
  if (/hotel|mastcraft|planning|development|lease|scheme|property/.test(value)) out.push('Planning & development');
  if (/charity commission|tribunal|court|appeal|judge|legal/.test(value)) out.push('Council & democracy');
  return [...new Set(out)].slice(0, 3);
}

function extractChronology(html = '') {
  const text = htmlToText(html);
  const matches = [];
  DATE_RX.lastIndex = 0;
  let match;
  while ((match = DATE_RX.exec(text))) {
    matches.push({ index: match.index + match[1].length, end: DATE_RX.lastIndex, day: match[2], month: match[3], year: match[4] });
  }

  const items = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const publishedAt = isoDate(current.day, current.month, current.year);
    if (!publishedAt) continue;
    const body = text.slice(current.end, next ? next.index : text.length).replace(/\s+/g, ' ').trim();
    if (body.length < 20) continue;
    const dateKey = publishedAt.slice(0, 10);
    const titleText = summaryTitle(body);
    const summary = body.length > 420 ? `${body.slice(0, 417).trimEnd()}…` : body;
    const identity = `${SOURCE.id}:${dateKey}:${titleText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)}`;

    items.push({
      id: identity,
      sourceId: SOURCE.id,
      source: SOURCE.name,
      sourceClass: SOURCE.sourceClass,
      sourceHomepage: SOURCE.homepage,
      mediaType: null,
      title: `Victoria Hall chronology: ${titleText}`,
      url: SOURCE.url,
      canonicalUrl: null,
      dedupeKey: identity,
      summary,
      publishedAt,
      towns: ['Ealing'],
      topics: topics(body),
      derived: true,
      derivedFrom: 'Dated entry on the Friends of the Victoria Hall chronology'
    });
  }

  return items.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

async function fetchHtml() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(SOURCE.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    return { response, html: response.ok ? await response.text() : '' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchVictoriaHallChronology({ deep = false } = {}) {
  const started = Date.now();
  try {
    const { response, html } = await fetchHtml();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const all = extractChronology(html);
    const archiveItems = all.slice(0, deep ? 250 : 20);
    const items = archiveItems.slice(0, 8);
    return {
      generatedAt: new Date().toISOString(),
      items,
      archiveItems,
      health: [{
        ...SOURCE,
        ok: all.length > 0,
        status: all.length ? 'ok' : 'empty',
        error: all.length ? null : 'Chronology page responded but no dated entries matched the expected structure',
        itemCount: all.length,
        diagnostics: [{ mode: deep ? 'chronology-deep' : 'chronology-live', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started }]
      }]
    };
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
    return {
      generatedAt: new Date().toISOString(),
      items: [],
      archiveItems: [],
      health: [{ ...SOURCE, ok: false, status: 'error', error: message, itemCount: 0, diagnostics: [{ mode: 'chronology-live', outcome: 'transport-error', error: message, elapsedMs: Date.now() - started }] }]
    };
  }
}

export default async () => {
  const data = await fetchVictoriaHallChronology();
  return new Response(JSON.stringify({ generatedAt: data.generatedAt, items: data.items, health: data.health }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
