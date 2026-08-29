import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });
const arr = value => value == null ? [] : Array.isArray(value) ? value : [value];

const topicFeeds = [
  ['201033', 'https://www.ealing.gov.uk/rss/201033/news'],
  ['201155', 'https://www.ealing.gov.uk/rss/201155/news'],
  ['201149', 'https://www.ealing.gov.uk/rss/201149/news'],
  ['201146', 'https://www.ealing.gov.uk/rss/201146/news'],
  ['201167', 'https://www.ealing.gov.uk/rss/201167/news'],
  ['200125', 'https://www.ealing.gov.uk/rss/200125/news'],
  ['201137', 'https://www.ealing.gov.uk/rss/201137/news'],
  ['201219', 'https://www.ealing.gov.uk/rss/201219/news'],
  ['201226', 'https://www.ealing.gov.uk/rss/201226/news'],
  ['201086', 'https://www.ealing.gov.uk/rss/201086/news'],
  ['201020', 'https://www.ealing.gov.uk/rss/201020/news'],
  ['201010', 'https://www.ealing.gov.uk/rss/201010/news'],
  ['200146', 'https://www.ealing.gov.uk/rss/200146/news']
].map(([categoryId, url]) => ({ categoryId, url }));

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
  hellip: '…', bull: '•', middot: '·', pound: '£', euro: '€'
};

const decodeCodePoint = (raw, radix) => {
  const code = Number.parseInt(raw, radix);
  return Number.isInteger(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : null;
};

function decodeEntities(value = '') {
  return String(value)
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex) => decodeCodePoint(hex, 16) ?? match)
    .replace(/&#([0-9]+);?/g, (match, dec) => decodeCodePoint(dec, 10) ?? match)
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name) => namedEntities[name.toLowerCase()] ?? match);
}

const strip = (html = '') => decodeEntities(String(html).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const textValue = value => value?.['#text'] ?? value ?? '';

function itemLink(item) {
  const linkRaw = item?.link;
  if (typeof linkRaw === 'string') return linkRaw;
  if (Array.isArray(linkRaw)) {
    return linkRaw.find(link => link?.['@_rel'] === 'alternate')?.['@_href'] || linkRaw[0]?.['@_href'] || null;
  }
  return linkRaw?.['@_href'] || null;
}

function canonicalUrl(value) {
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

function cleanCategoryLabel(value, categoryId) {
  const label = strip(textValue(value))
    .replace(/^Ealing Council\s*(?:[-–—:|]\s*)?/i, '')
    .replace(/\s*(?:RSS|feed)\s*$/i, '')
    .trim();
  return label && !/^news$/i.test(label) ? label : `Council category ${categoryId}`;
}

function civicTopics(value) {
  const text = String(value).toLowerCase();
  const rules = [
    ['Planning & development', /planning|development|regeneration|construction|building control/],
    ['Housing', /housing|tenant|rent|homeless|council tax|homeownership|home ownership/],
    ['Environment', /environment|climate|recycling|waste|rubbish|air quality|pollution|parks?|trees?|green space/],
    ['Transport', /transport|traffic|roads?|parking|cycling|walking|bus|rail|street|highways?/],
    ['Schools & young people', /school|education|children|young people|youth|nursery|family|families/],
    ['Policing & safety', /crime|police|community safety|antisocial|anti-social|asb|licensing|emergency/],
    ['Culture & history', /culture|arts?|heritage|history|libraries?|museum|events?|leisure|sport/],
    ['Council & democracy', /council|democracy|elections?|consultation|committee|cabinet|scrutiny|decision/]
  ];
  return rules.filter(([, rx]) => rx.test(text)).map(([topic]) => topic);
}

async function fetchTopicFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parser.parse(await response.text());
    const channel = parsed?.rss?.channel;
    if (!channel) throw new Error('Unrecognized RSS feed structure');

    const category = cleanCategoryLabel(channel.title, feed.categoryId);
    const topics = civicTopics(category);
    const entries = arr(channel.item).map(item => ({
      url: canonicalUrl(itemLink(item)),
      category,
      topics: [...new Set([...topics, ...civicTopics(strip(textValue(item.title)))])]
    })).filter(entry => entry.url);

    return { ok: true, categoryId: feed.categoryId, entries };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichEalingCouncilTopics(items) {
  const settled = await Promise.allSettled(topicFeeds.map(fetchTopicFeed));
  const index = new Map();
  let fetched = 0;
  let failed = 0;

  for (const result of settled) {
    if (result.status !== 'fulfilled' || !result.value.ok) {
      failed += 1;
      continue;
    }
    fetched += 1;
    for (const entry of result.value.entries) {
      const existing = index.get(entry.url) || { categories: new Set(), topics: new Set() };
      existing.categories.add(entry.category);
      entry.topics.forEach(topic => existing.topics.add(topic));
      index.set(entry.url, existing);
    }
  }

  let matchedItems = 0;
  const enrichedItems = items.map(item => {
    if (item.sourceId !== 'ealing-council-news') return item;
    const match = index.get(canonicalUrl(item.canonicalUrl || item.url));
    if (!match) return item;
    matchedItems += 1;
    const officialTopics = [...match.topics];
    return {
      ...item,
      topics: [...new Set([...officialTopics, ...(item.topics || [])])].slice(0, 3),
      officialCategories: [...match.categories],
      topicProvenance: officialTopics.length ? 'Ealing Council category RSS' : item.topicProvenance || null
    };
  });

  return {
    items: enrichedItems,
    diagnostics: {
      publisher: 'Ealing Council',
      topicFeedsTotal: topicFeeds.length,
      topicFeedsFetched: fetched,
      topicFeedsFailed: failed,
      matchedItems
    }
  };
}
