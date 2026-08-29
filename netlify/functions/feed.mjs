import { XMLParser } from 'fast-xml-parser';

const sources = [
  {
    id: 'southall-stories',
    name: 'Southall Stories',
    url: 'https://southallstories.uk/feed.xml',
    homepage: 'https://southallstories.uk/',
    sourceClass: 'Journalism / publishing',
    towns: ['Southall'],
    defaultTopics: ['Council & democracy', 'Community']
  },
  {
    id: 'community-powered-reporting',
    name: 'Community Powered Reporting',
    url: 'https://communitypoweredreporting.co.uk/feed/',
    homepage: 'https://communitypoweredreporting.co.uk/',
    sourceClass: 'Journalism / publishing',
    towns: ['Southall'],
    defaultTopics: ['Council & democracy', 'Community']
  },
  {
    id: 'neighbours-paper',
    name: 'The Neighbours’ Paper',
    url: 'https://neighbourspaper.org/feed/',
    homepage: 'https://neighbourspaper.org/',
    sourceClass: 'Journalism / publishing',
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    defaultTopics: ['Council & democracy', 'Community']
  },
  {
    id: 'southall-residents-alliance',
    name: 'Southall Residents Alliance',
    url: 'https://southallresidentsalliance.co.uk/feed/',
    homepage: 'https://southallresidentsalliance.co.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall'],
    defaultTopics: ['Community']
  },
  {
    id: 'southall-transition',
    name: 'Southall Transition',
    url: 'https://southalltransition.org/feed/',
    homepage: 'https://southalltransition.org/',
    sourceClass: 'Organisation / campaign',
    towns: ['Southall'],
    defaultTopics: ['Environment', 'Community']
  },
  {
    id: 'ealing-matters',
    name: 'Ealing Matters',
    url: 'https://ealingmatters.org.uk/feed/',
    homepage: 'https://ealingmatters.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'west-ealing-neighbours',
    name: 'West Ealing Neighbours',
    url: 'https://www.westealingneighbours.org.uk/feed/',
    homepage: 'https://www.westealingneighbours.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Ealing'],
    defaultTopics: ['Community']
  },
  {
    id: 'ealing-transition',
    name: 'Ealing Transition',
    url: 'https://ealingtransition.org.uk/feed/',
    homepage: 'https://ealingtransition.org.uk/',
    sourceClass: 'Organisation / campaign',
    towns: ['Ealing'],
    defaultTopics: ['Environment', 'Community']
  },
  {
    id: 'east-acton-golf-links',
    name: 'East Acton Golf Links Residents’ Association',
    url: 'https://eaglra.wordpress.com/feed/',
    homepage: 'https://eaglra.wordpress.com/',
    sourceClass: 'Organisation / campaign',
    towns: ['Acton'],
    defaultTopics: ['Planning & development', 'Community']
  },
  {
    id: 'modern-gov',
    name: 'Ealing Council — ModernGov',
    url: 'https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0',
    homepage: 'https://ealing.moderngov.co.uk/',
    sourceClass: 'Official record',
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    defaultTopics: ['Council & democracy'],
    browserRetry: true,
    referer: 'https://ealing.moderngov.co.uk/mgWhatsNew.aspx?bcr=1'
  },
  {
    id: 'ealing-council-news',
    name: 'Ealing Council — News',
    url: 'https://www.ealing.gov.uk/rss/news',
    homepage: 'https://www.ealing.gov.uk/news',
    sourceClass: 'Official record',
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    defaultTopics: ['Council & democracy', 'Community']
  },
  {
    id: 'open-council-network-reddit-ealing',
    name: 'Open Council Network — Ealing updates',
    url: 'https://www.reddit.com/r/OpenCouncilNetwork/search.rss?q=Ealing&restrict_sr=1&sort=new',
    homepage: 'https://www.reddit.com/r/OpenCouncilNetwork/',
    sourceClass: 'Independent civic data / analysis',
    towns: ['Ealing', 'Acton', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'],
    defaultTopics: ['Council & democracy'],
    extractEalingSection: true
  },
  {
    id: 'view-from-w5',
    name: 'The View from W5',
    url: 'https://theviewfromw5.substack.com/feed',
    homepage: 'https://theviewfromw5.substack.com/',
    sourceClass: 'Journalism / publishing',
    towns: ['Ealing'],
    defaultTopics: ['Council & democracy']
  },
  {
    id: 'my-southall',
    name: 'MySouthall',
    url: 'https://southall.substack.com/feed',
    homepage: 'https://southall.substack.com/',
    sourceClass: 'Journalism / publishing',
    towns: ['Southall'],
    defaultTopics: ['Council & democracy', 'Community']
  }
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
  hellip: '…', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™',
  pound: '£', euro: '€'
};

const decodeCodePoint = (raw, radix) => {
  const code = Number.parseInt(raw, radix);
  return Number.isInteger(code) && code >= 0 && code <= 0x10FFFF
    ? String.fromCodePoint(code)
    : null;
};

function decodeEntities(value = '') {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex) => decodeCodePoint(hex, 16) ?? match)
    .replace(/&#([0-9]+);?/g, (match, dec) => decodeCodePoint(dec, 10) ?? match)
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

const strip = (html = '') => decodeEntities(String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim();

const textValue = value => value?.['#text'] ?? value ?? '';

function extractEalingSection(rawHtml = '') {
  const html = decodeEntities(String(rawHtml));

  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let paragraphMatch;
  while ((paragraphMatch = paragraphPattern.exec(html))) {
    const paragraphText = strip(paragraphMatch[1]);
    if (/^(?:Ealing(?:\s+(?:Council|LBC))?|London Borough of Ealing)\b[\s:–—-]*/i.test(paragraphText) && paragraphText.length >= 20) {
      return paragraphText;
    }
  }

  const heading = /<h([1-6])\b[^>]*>\s*(?:<[^>]+>\s*)*Ealing(?:\s+(?:Council|LBC|London Borough of Ealing))?\s*(?:<\/[^>]+>\s*)*<\/h\1>/i.exec(html);

  if (heading) {
    const headingLevel = Number.parseInt(heading[1], 10);
    const afterHeading = html.slice(heading.index + heading[0].length);
    const headingPattern = /<h([1-6])\b[^>]*>/gi;
    let nextHeading;
    let match;
    while ((match = headingPattern.exec(afterHeading))) {
      if (Number.parseInt(match[1], 10) <= headingLevel) {
        nextHeading = match;
        break;
      }
    }
    const sectionHtml = nextHeading ? afterHeading.slice(0, nextHeading.index) : afterHeading;
    const text = strip(sectionHtml);
    if (text.length >= 20) return text;
  }

  const strongHeading = /<p\b[^>]*>\s*<(?:strong|b)\b[^>]*>\s*Ealing(?:\s+(?:Council|LBC|London Borough of Ealing))?\s*<\/(?:strong|b)>\s*<\/p>/i.exec(html);
  if (strongHeading) {
    const afterHeading = html.slice(strongHeading.index + strongHeading[0].length);
    const nextStrongHeading = /<p\b[^>]*>\s*<(?:strong|b)\b[^>]*>\s*[A-Z][A-Za-z '&.-]{2,60}\s*<\/(?:strong|b)>\s*<\/p>/i.exec(afterHeading);
    const sectionHtml = nextStrongHeading ? afterHeading.slice(0, nextStrongHeading.index) : afterHeading;
    const text = strip(sectionHtml);
    if (text.length >= 20) return text;
  }

  return null;
}

function topicGuess(title, defaults) {
  const text = title.toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|tower|housing scheme|application|regeneration|construction/],
    ['Housing', /housing|tenant|rent|homeless|homebuilding/],
    ['Environment', /air quality|pollution|climate|green|park|tree|environment|recycling|waste/],
    ['Transport', /traffic|transport|bus|rail|road|parking|cycle|street|tube|elizabeth line/],
    ['Schools & young people', /school|children|young people|youth|education|nursery/],
    ['Policing & safety', /police|crime|safety|asb|antisocial|anti-social|licensing/],
    ['Culture & history', /history|heritage|arts|culture|cinema|museum|conservation/],
    ['Council & democracy', /council|cabinet|committee|scrutiny|election|petition|consultation|meeting|minutes|agenda/]
  ];
  const hits = rules.filter(([, rx]) => rx.test(text)).map(([name]) => name);
  return [...new Set([...hits, ...defaults])].slice(0, 3);
}

function normaliseDate(value) {
  if (!value) return null;
  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normaliseItem(source, item) {
  const originalTitle = strip(textValue(item.title) || 'Untitled');
  const linkRaw = item.link;
  const link = typeof linkRaw === 'string' ? linkRaw : Array.isArray(linkRaw)
    ? (linkRaw.find(l => l?.['@_rel'] === 'alternate')?.['@_href'] || linkRaw[0]?.['@_href'])
    : (linkRaw?.['@_href'] || source.homepage);
  const rawDescription = textValue(item.description ?? item.summary ?? item['content:encoded'] ?? item.content);
  const extracted = source.extractEalingSection ? extractEalingSection(rawDescription) : null;
  const description = extracted || strip(rawDescription);
  const title = extracted && !/^ealing\b/i.test(originalTitle) ? `Ealing — ${originalTitle}` : originalTitle;
  const summaryPrefix = extracted ? 'Commons extract from OCN’s public roundup: ' : '';
  const published = item.pubDate ?? item.published ?? item.updated ?? item.date ?? null;
  const summary = `${summaryPrefix}${description}`;
  return {
    id: `${source.id}:${item.guid?.['#text'] ?? item.guid ?? item.id ?? link ?? originalTitle}`,
    sourceId: source.id,
    source: source.name,
    sourceClass: source.sourceClass,
    sourceHomepage: source.homepage,
    title,
    url: link || source.homepage,
    summary: extracted ? summary : summary.slice(0, 420),
    publishedAt: normaliseDate(published),
    towns: source.towns,
    topics: topicGuess(`${title} ${description}`, source.defaultTopics),
    derived: Boolean(extracted),
    derivedFrom: extracted ? 'OCN Reddit roundup' : null
  };
}

function requestHeaders(source, browserLike = false) {
  const headers = {
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
    'accept-language': 'en-GB,en;q=0.9',
    'user-agent': browserLike
      ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
      : 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
  };
  if (browserLike && source.referer) headers.referer = source.referer;
  return headers;
}

function errorMessage(error) {
  return error?.name === 'AbortError' ? 'Timed out' : String(error?.message || error);
}

async function fetchAttempt(source, browserLike = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  const startedAt = Date.now();
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: requestHeaders(source, browserLike)
    });
    const body = response.ok ? await response.text() : null;
    return { response, body, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    error.fetchElapsedMs = Date.now() - startedAt;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function recordedAttempt(source, browserLike, diagnostics) {
  const mode = browserLike ? 'browser-compatible' : 'civic-reader';
  try {
    const attempt = await fetchAttempt(source, browserLike);
    diagnostics.push({
      mode,
      outcome: 'http-response',
      httpStatus: attempt.response.status,
      elapsedMs: attempt.elapsedMs
    });
    return attempt;
  } catch (error) {
    diagnostics.push({
      mode,
      outcome: 'transport-error',
      error: errorMessage(error),
      elapsedMs: error.fetchElapsedMs ?? null
    });
    throw error;
  }
}

async function fetchSource(source) {
  const diagnostics = [];
  let attempt;

  try {
    attempt = await recordedAttempt(source, false, diagnostics);
  } catch (firstError) {
    if (!source.browserRetry) {
      return { source, ok: false, status: 'error', error: errorMessage(firstError), items: [], diagnostics };
    }

    try {
      attempt = await recordedAttempt(source, true, diagnostics);
    } catch (retryError) {
      return {
        source,
        ok: false,
        status: 'upstream',
        error: `Official source unavailable to automated fetch after retry (${errorMessage(retryError)})`,
        items: [],
        diagnostics
      };
    }
  }

  if (!attempt.response.ok && source.browserRetry && [401, 403, 406, 429].includes(attempt.response.status) && diagnostics.length === 1) {
    try {
      attempt = await recordedAttempt(source, true, diagnostics);
    } catch (retryError) {
      return {
        source,
        ok: false,
        status: 'upstream',
        error: `Official source retry failed before a response (${errorMessage(retryError)})`,
        items: [],
        diagnostics
      };
    }
  }

  const res = attempt.response;
  if (!res.ok) {
    const blocked = source.browserRetry && [401, 403, 406, 429].includes(res.status);
    return {
      source,
      ok: false,
      status: blocked ? 'blocked' : 'error',
      error: blocked ? `Upstream blocked automated fetch (HTTP ${res.status})` : `HTTP ${res.status}`,
      items: [],
      diagnostics
    };
  }

  try {
    const parsed = parser.parse(attempt.body);
    const rssChannel = parsed?.rss?.channel;
    const atomFeed = parsed?.feed;

    if (!rssChannel && !atomFeed) {
      throw new Error('Unrecognized RSS/Atom feed structure');
    }

    const rawItems = rssChannel ? arr(rssChannel.item) : arr(atomFeed.entry);
    return {
      source,
      ok: true,
      status: 'ok',
      items: rawItems.slice(0, 15).map(item => normaliseItem(source, item)),
      diagnostics
    };
  } catch (error) {
    return {
      source,
      ok: false,
      status: 'error',
      error: errorMessage(error),
      items: [],
      diagnostics
    };
  }
}

function canonicalItemUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(value).trim();
  }
}

function dedupeItemsByCanonicalUrl(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = canonicalItemUrl(item.url) || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async () => {
  const results = await Promise.all(sources.map(fetchSource));
  const items = dedupeItemsByCanonicalUrl(results.flatMap(r => r.items)).sort((a, b) => {
    const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bd - ad;
  }).slice(0, 80);
  const health = results.map(r => ({
    id: r.source.id,
    name: r.source.name,
    homepage: r.source.homepage,
    ok: r.ok,
    status: r.status || (r.ok ? 'ok' : 'error'),
    error: r.error || null,
    itemCount: r.items.length,
    diagnostics: r.source.browserRetry ? r.diagnostics : undefined
  }));
  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), items, health }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};