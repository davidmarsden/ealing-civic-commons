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
    defaultTopics: ['Council & democracy']
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
  const title = strip(item.title?.['#text'] ?? item.title ?? 'Untitled');
  const linkRaw = item.link;
  const link = typeof linkRaw === 'string' ? linkRaw : Array.isArray(linkRaw)
    ? (linkRaw.find(l => l?.['@_rel'] === 'alternate')?.['@_href'] || linkRaw[0]?.['@_href'])
    : (linkRaw?.['@_href'] || source.homepage);
  const description = strip(item.description ?? item.summary ?? item['content:encoded'] ?? item.content ?? '');
  const published = item.pubDate ?? item.published ?? item.updated ?? item.date ?? null;
  return {
    id: `${source.id}:${item.guid?.['#text'] ?? item.guid ?? item.id ?? link ?? title}`,
    sourceId: source.id,
    source: source.name,
    sourceClass: source.sourceClass,
    sourceHomepage: source.homepage,
    title,
    url: link || source.homepage,
    summary: description.slice(0, 420),
    publishedAt: normaliseDate(published),
    towns: source.towns,
    topics: topicGuess(title, source.defaultTopics)
  };
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const xml = await res.text();
    const parsed = parser.parse(xml);
    const rssChannel = parsed?.rss?.channel;
    const atomFeed = parsed?.feed;

    if (!rssChannel && !atomFeed) {
      throw new Error('Unrecognized RSS/Atom feed structure');
    }

    const rawItems = rssChannel ? arr(rssChannel.item) : arr(atomFeed.entry);
    return { source, ok: true, items: rawItems.slice(0, 15).map(item => normaliseItem(source, item)) };
  } catch (error) {
    return { source, ok: false, error: error.name === 'AbortError' ? 'Timed out' : String(error.message || error), items: [] };
  } finally {
    clearTimeout(timeout);
  }
}

export default async () => {
  const results = await Promise.all(sources.map(fetchSource));
  const items = results.flatMap(r => r.items).sort((a, b) => {
    const ad = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bd = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bd - ad;
  }).slice(0, 80);
  const health = results.map(r => ({ id: r.source.id, name: r.source.name, ok: r.ok, error: r.error || null, itemCount: r.items.length }));
  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), items, health }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=900',
      'access-control-allow-origin': '*'
    }
  });
};
