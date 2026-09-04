import { createHash } from 'node:crypto';

const sources = [
  {
    id: 'ealing-foe-current-news',
    name: 'Ealing Friends of the Earth — Current news',
    url: 'https://www.ealingfoe.org.uk/',
    homepage: 'https://www.ealingfoe.org.uk/',
    sourceClass: 'Organisation / campaign',
    defaultTopics: ['Environment', 'Community'],
    startAfter: 'This is a new website for Ealing Friends of the Earth.',
    startMarker: 'News',
    endMarker: 'Coming Up - things to do',
    titlePatterns: [/Yet Another Park Royal Data Centre/i, /Charter of Hope/i, /Middlesex Pride 2026/i, /May 2026 Elections/i]
  },
  {
    id: 'monitoring-group-drum',
    name: 'The Monitoring Group — The Drum',
    url: 'https://tmg-uk.org/thedrumnewsletter',
    homepage: 'https://tmg-uk.org/',
    sourceClass: 'Organisation / campaign',
    defaultTopics: ['Council & democracy', 'Policing & safety'],
    startMarker: 'The Drum - news from The Monitoring Group',
    endMarker: 'The Monitoring Group 2 Langley Lane',
    titlePatterns: [/New:\s*Launch of Nottingham Solidarity Network/i, /Special report:\s*England 2024 riots and the cycle of racist violence/i]
  },
  {
    id: 'ealing-community-independents-current',
    name: 'Ealing Community Independents — Current publication',
    url: 'https://ealingindependents.org/news/',
    homepage: 'https://ealingindependents.org/',
    sourceClass: 'Political organisation / campaign',
    defaultTopics: ['Council & democracy', 'Community'],
    startMarker: 'Your voice, your choice',
    endMarker: 'Contact',
    titlePatterns: [/Extortionate Uniform Prices at Ealing Public Schools/i, /Your voice, your choice/i, /People-led politics/i]
  }
];

const towns = ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…'
};

function decodeEntities(value = '') {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isInteger(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    })
    .replace(/&#([0-9]+);?/g, (match, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    })
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

function strip(html = '') {
  return decodeEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSection(text, source) {
  let searchFrom = 0;
  if (source.startAfter) {
    const anchor = text.indexOf(source.startAfter);
    if (anchor >= 0) searchFrom = anchor + source.startAfter.length;
  }

  const start = text.indexOf(source.startMarker, searchFrom);
  if (start < 0) return null;
  const bodyStart = start + source.startMarker.length;
  const end = source.endMarker ? text.indexOf(source.endMarker, bodyStart) : -1;
  const section = text.slice(bodyStart, end >= 0 ? end : undefined).trim();
  return section.length >= 80 ? section : null;
}

function inferredTowns(text = '') {
  return towns.filter(town => new RegExp(`(^|[^A-Za-z])${escapeRegex(town)}([^A-Za-z]|$)`, 'i').test(text));
}

function topicGuess(text, defaults = []) {
  const value = String(text || '').toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|data centre|opdc|green quarter/],
    ['Housing', /housing|tenant|rent|homeless|home/],
    ['Environment', /air quality|pollution|climate|green|park|tree|environment|biodiversity|heathrow|data centre/],
    ['Transport', /traffic|transport|bus|rail|road|parking|cycle|heathrow/],
    ['Policing & safety', /police|policing|crime|racist violence|hate crime|custody|undercover/],
    ['Council & democracy', /council|election|councillor|government|inquiry|accountability|justice/],
    ['Public health', /health|heatwave|air quality|wellbeing/]
  ];
  return [...new Set([...rules.filter(([, rx]) => rx.test(value)).map(([name]) => name), ...defaults])].slice(0, 3);
}

function headline(source, section) {
  for (const pattern of source.titlePatterns || []) {
    const match = section.match(pattern);
    if (match?.[0]) return match[0].replace(/\s+/g, ' ').trim();
  }
  return source.name;
}

function itemFromSection(source, section) {
  const digest = createHash('sha256').update(section, 'utf8').digest('hex').slice(0, 16);
  const title = headline(source, section);
  const summary = section.length > 650 ? `${section.slice(0, 647).trimEnd()}…` : section;
  return {
    id: `${source.id}:${digest}`,
    sourceId: source.id,
    source: source.name,
    sourceClass: source.sourceClass,
    sourceHomepage: source.homepage,
    mediaType: null,
    title,
    url: source.url,
    canonicalUrl: source.url,
    summary,
    publishedAt: null,
    towns: inferredTowns(section),
    topics: topicGuess(section, source.defaultTopics),
    derived: true,
    derivedFrom: 'Versioned snapshot of a living public publication page',
    contentVersion: digest,
    dateStatus: 'Publisher does not expose a reliable per-entry publication date on this living page'
  };
}

async function requestSource(source, browserCompatible = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), browserCompatible ? 12000 : 7500);
  try {
    return await fetch(source.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: browserCompatible
          ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': browserCompatible
          ? 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
          : 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSource(source) {
  const started = Date.now();
  const diagnostics = [];
  try {
    let response;
    try {
      response = await requestSource(source, false);
      diagnostics.push({ mode: 'living-page-watch', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - started });
    } catch (error) {
      diagnostics.push({ mode: 'living-page-watch', outcome: 'transport-error', error: String(error?.message || error), elapsedMs: Date.now() - started });
    }

    if (!response?.ok) {
      const retryStarted = Date.now();
      response = await requestSource(source, true);
      diagnostics.push({ mode: 'browser-compatible', outcome: 'http-response', httpStatus: response.status, elapsedMs: Date.now() - retryStarted });
    }

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = strip(await response.text());
    const section = extractSection(text, source);
    const items = section ? [itemFromSection(source, section)] : [];
    return {
      items,
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: true,
        status: items.length ? 'ok' : 'empty',
        error: items.length ? null : 'Page fetched but the configured living-publication section was not found',
        itemCount: items.length,
        diagnostics
      }
    };
  } catch (error) {
    return {
      items: [],
      health: {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        ok: false,
        status: 'error',
        error: error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error),
        itemCount: 0,
        diagnostics
      }
    };
  }
}

export async function fetchLivingPageFeed() {
  const results = await Promise.all(sources.map(fetchSource));
  return {
    generatedAt: new Date().toISOString(),
    items: results.flatMap(result => result.items),
    health: results.map(result => result.health)
  };
}

export default async () => {
  const data = await fetchLivingPageFeed();
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
