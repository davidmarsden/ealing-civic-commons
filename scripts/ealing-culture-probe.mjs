#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = 'https://ealingculture.org/';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const args = new Set(process.argv.slice(2));
const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(outputArg ? outputArg.slice('--output='.length) : 'ealing-culture-probe.json');
const verbose = args.has('--verbose');

const ENDPOINTS = [
  ['homepage', '/'],
  ['robots', '/robots.txt'],
  ['sitemap_index', '/sitemap_index.xml'],
  ['sitemap', '/sitemap.xml'],
  ['feed', '/feed/'],
  ['rss', '/rss/'],
  ['wp_json', '/wp-json/'],
  ['wp_types', '/wp-json/wp/v2/types'],
  ['wp_taxonomies', '/wp-json/wp/v2/taxonomies'],
  ['latest_news', '/latest-news/'],
  ['whats_on', '/whats-on/'],
  ['spaces', '/spaces-for-hire/'],
  ['creatives', '/creatives-directory/'],
];

const TARGET_TYPES = ['event', 'news', 'venue', 'creative'];

function decodeEntities(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(value = '') {
  return decodeEntities(value.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function absoluteUrl(value, base = BASE) {
  if (!value) return null;
  try {
    return new URL(decodeEntities(value), base).toString();
  } catch {
    return null;
  }
}

function responseDiagnostics(response) {
  return {
    status: response.status,
    status_text: response.statusText,
    url: response.url,
    content_type: response.headers.get('content-type'),
    server: response.headers.get('server'),
    powered_by: response.headers.get('x-powered-by'),
    generator: response.headers.get('x-generator'),
    cache: response.headers.get('x-cache') ?? response.headers.get('cf-cache-status'),
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml,text/xml,application/json;q=0.9,*/*;q=0.8',
      'accept-language': 'en-GB,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  return { response, text };
}

async function fetchJson(url) {
  const { response, text } = await fetchText(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  try {
    return { response, json: JSON.parse(text), text };
  } catch {
    throw new Error(`Expected JSON from ${response.url}`);
  }
}

function detectPlatform(html = '', headers = {}) {
  const lower = html.toLowerCase();
  const generator = html.match(/<meta\s+[^>]*name=["']generator["'][^>]*content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']generator["']/i)?.[1]
    ?? null;
  const hints = [];

  if (/wp-content|wp-includes|wordpress/i.test(html) || /wordpress/i.test(generator || '')) hints.push('wordpress');
  if (/jadu/i.test(html) || /jadu/i.test(generator || '') || /jadu/i.test(headers.powered_by || '')) hints.push('jadu');
  if (/drupal/i.test(html) || /drupal/i.test(generator || '')) hints.push('drupal');

  return {
    generator,
    hints: [...new Set(hints)],
    markers: {
      wp_content: lower.includes('wp-content'),
      wp_includes: lower.includes('wp-includes'),
      jadu: lower.includes('jadu'),
      json_ld: /<script[^>]+type=["']application\/ld\+json["']/i.test(html),
      rss_link: /<link[^>]+type=["']application\/(?:rss|atom)\+xml["']/i.test(html),
    },
  };
}

function discoverLinks(html = '', baseUrl = BASE) {
  const links = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = absoluteUrl(match[1], baseUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    links.push({ url, text: stripTags(match[2]) || null });
  }
  return links;
}

function classifyLinks(links) {
  const buckets = {
    event: [], event_type: [], event_location: [], audience: [], news: [], news_category: [],
    creative: [], creative_category: [], creative_location: [], space: [], suitability: [], pagination: [],
  };

  for (const link of links) {
    const path = new URL(link.url).pathname;
    if (/^\/event\/[^/]+\/?$/.test(path)) buckets.event.push(link);
    else if (/^\/event-type\//.test(path)) buckets.event_type.push(link);
    else if (/^\/(?:event-location|location)\//.test(path)) buckets.event_location.push(link);
    else if (/^\/(?:audience|event-audience)\//.test(path)) buckets.audience.push(link);
    else if (/^\/news\/[^/]+\/?$/.test(path)) buckets.news.push(link);
    else if (/^\/(?:news-category|category)\//.test(path)) buckets.news_category.push(link);
    else if (/^\/(?:creative|creatives)\/[^/]+\/?$/.test(path)) buckets.creative.push(link);
    else if (/^\/creative-category\//.test(path)) buckets.creative_category.push(link);
    else if (/^\/creative-location\//.test(path)) buckets.creative_location.push(link);
    else if (/^\/(?:space|spaces)\/[^/]+\/?$/.test(path)) buckets.space.push(link);
    else if (/^\/suitability\//.test(path)) buckets.suitability.push(link);
    if (/\/page\/\d+\/?$/.test(path) || /[?&](?:paged|page)=\d+/i.test(link.url)) buckets.pagination.push(link);
  }

  for (const key of Object.keys(buckets)) {
    const uniq = new Map(buckets[key].map((item) => [item.url, item]));
    buckets[key] = [...uniq.values()].slice(0, 25);
  }
  return buckets;
}

function extractLdJson(html = '') {
  const results = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        results.push({
          type: row['@type'] ?? null,
          name: row.name ?? row.headline ?? null,
          url: row.url ?? row.mainEntityOfPage ?? null,
          startDate: row.startDate ?? null,
          endDate: row.endDate ?? null,
          location: row.location ?? null,
        });
      }
    } catch {
      results.push({ parse_error: true, preview: raw.slice(0, 200) });
    }
  }
  return results.slice(0, 20);
}

function extractCanonical(html = '', baseUrl = BASE) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = tag.match(/\brel\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
    if (!rel.split(/\s+/).some((value) => value.toLowerCase() === 'canonical')) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
    return absoluteUrl(href, baseUrl);
  }
  return null;
}

function extractVisibleSample(html = '', baseUrl = BASE) {
  const text = stripTags(html);
  const links = classifyLinks(discoverLinks(html, baseUrl));
  const dates = [...text.matchAll(/\b(?:Every\s+[A-Za-z]+|\d{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{4})\b/g)].map((m) => m[0]);
  return {
    title: stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || null,
    canonical: extractCanonical(html, baseUrl),
    date_patterns: [...new Set(dates)].slice(0, 20),
    links,
    ld_json: extractLdJson(html),
    text_preview: text.slice(0, 700),
  };
}

function isFeedResponse(response, text) {
  const contentType = response.headers.get('content-type') || '';
  if (/application\/(?:rss|atom)\+xml|application\/xml|text\/xml/i.test(contentType)) {
    return /<(?:rss|feed)\b/i.test(text);
  }
  return /^\s*<\?xml[\s\S]*<(?:rss|feed)\b/i.test(text);
}

async function probeEndpoint(name, path) {
  const started = Date.now();
  const url = new URL(path, BASE);
  try {
    const { response, text } = await fetchText(url);
    const diagnostics = responseDiagnostics(response);
    const contentType = diagnostics.content_type || '';
    let json = null;
    if (/application\/json/i.test(contentType) || /^[\s\r\n]*[\[{]/.test(text)) {
      try { json = JSON.parse(text); } catch { /* diagnostic only */ }
    }
    const feedValid = name === 'feed' || name === 'rss' ? isFeedResponse(response, text) : undefined;
    return {
      ok: response.ok,
      name,
      ...diagnostics,
      bytes: Buffer.byteLength(text),
      elapsed_ms: Date.now() - started,
      ...(feedValid === undefined ? {} : { feed_valid: feedValid }),
      platform: name === 'homepage' ? detectPlatform(text, diagnostics) : undefined,
      json_summary: json ? {
        kind: Array.isArray(json) ? 'array' : typeof json,
        keys: Array.isArray(json) ? null : Object.keys(json).slice(0, 30),
        count: Array.isArray(json) ? json.length : null,
      } : null,
      sample: /text\/html|application\/xhtml\+xml/i.test(contentType) || /<html/i.test(text)
        ? extractVisibleSample(text, response.url)
        : text.slice(0, 500),
    };
  } catch (error) {
    return {
      ok: false,
      name,
      url: url.toString(),
      error: error instanceof Error ? error.message : String(error),
      elapsed_ms: Date.now() - started,
    };
  }
}

function compactWpRecord(row) {
  if (!row || typeof row !== 'object') return null;
  const result = {
    id: row.id ?? null,
    date: row.date ?? null,
    modified: row.modified ?? null,
    slug: row.slug ?? null,
    link: row.link ?? null,
    status: row.status ?? null,
    title: row.title?.rendered ?? row.title ?? null,
    field_keys: Object.keys(row),
  };
  for (const [key, value] of Object.entries(row)) {
    if (['id', 'date', 'modified', 'slug', 'link', 'status', 'title', 'content', 'excerpt', 'guid', '_links', '_embedded'].includes(key)) continue;
    if (Array.isArray(value) && value.every((item) => ['number', 'string'].includes(typeof item))) result[key] = value;
    else if (value == null || ['number', 'string', 'boolean'].includes(typeof value)) result[key] = value;
    else if (typeof value === 'object' && Object.keys(value).length <= 12) result[key] = value;
  }
  return result;
}

async function probeWordPressSchema() {
  const started = Date.now();
  try {
    const [{ json: types }, { json: taxonomies }] = await Promise.all([
      fetchJson(new URL('/wp-json/wp/v2/types', BASE)),
      fetchJson(new URL('/wp-json/wp/v2/taxonomies', BASE)),
    ]);

    const typeResults = {};
    for (const typeName of TARGET_TYPES) {
      const type = types[typeName];
      if (!type) {
        typeResults[typeName] = { available: false };
        continue;
      }
      const restBase = type.rest_base || typeName;
      const collectionUrl = new URL(`/wp-json/wp/v2/${restBase}`, BASE);
      collectionUrl.searchParams.set('per_page', '1');
      collectionUrl.searchParams.set('_embed', '1');
      const { response, json } = await fetchJson(collectionUrl);
      const rows = Array.isArray(json) ? json : [];
      typeResults[typeName] = {
        available: true,
        rest_base: restBase,
        rest_namespace: type.rest_namespace ?? 'wp/v2',
        taxonomies: type.taxonomies ?? [],
        collection_url: collectionUrl.toString(),
        total: Number(response.headers.get('x-wp-total') || rows.length),
        total_pages: Number(response.headers.get('x-wp-totalpages') || 1),
        sample: compactWpRecord(rows[0]),
      };
    }

    const taxonomyResults = {};
    const relevantTaxonomies = [...new Set(TARGET_TYPES.flatMap((name) => types[name]?.taxonomies ?? []))];
    for (const taxonomyName of relevantTaxonomies) {
      const taxonomy = taxonomies[taxonomyName];
      if (!taxonomy) {
        taxonomyResults[taxonomyName] = { available: false };
        continue;
      }
      const restBase = taxonomy.rest_base || taxonomyName;
      const collectionUrl = new URL(`/wp-json/wp/v2/${restBase}`, BASE);
      collectionUrl.searchParams.set('per_page', '100');
      const { response, json } = await fetchJson(collectionUrl);
      const rows = Array.isArray(json) ? json : [];
      taxonomyResults[taxonomyName] = {
        available: true,
        rest_base: restBase,
        rest_namespace: taxonomy.rest_namespace ?? 'wp/v2',
        types: taxonomy.types ?? [],
        total: Number(response.headers.get('x-wp-total') || rows.length),
        terms: rows.slice(0, 100).map((row) => ({ id: row.id, name: row.name, slug: row.slug, count: row.count, link: row.link })),
      };
    }

    return {
      ok: true,
      elapsed_ms: Date.now() - started,
      types: typeResults,
      taxonomies: taxonomyResults,
    };
  } catch (error) {
    return {
      ok: false,
      elapsed_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarize(results, wordpress) {
  const homepage = results.find((item) => item.name === 'homepage');
  const available = results.filter((item) => item.ok).map((item) => item.name);
  const wp = results.find((item) => item.name === 'wp_json');
  const feed = results.find((item) => item.name === 'feed');
  const rss = results.find((item) => item.name === 'rss');
  const sitemap = results.find((item) => item.name === 'sitemap_index' && item.ok)
    ?? results.find((item) => item.name === 'sitemap' && item.ok);

  const taxonomies = {};
  for (const item of results.filter((row) => row.sample?.links)) {
    for (const [key, values] of Object.entries(item.sample.links)) {
      if (!values.length) continue;
      taxonomies[key] ??= [];
      for (const value of values) {
        if (!taxonomies[key].some((existing) => existing.url === value.url)) taxonomies[key].push(value);
      }
      taxonomies[key] = taxonomies[key].slice(0, 25);
    }
  }

  const platformHints = homepage?.platform?.hints ?? [];
  const conventionalFeed = Boolean(feed?.feed_valid || rss?.feed_valid);
  const notes = [];
  if (platformHints.includes('jadu')) notes.push('Homepage contains Jadu markers.');
  if (platformHints.includes('wordpress')) notes.push('Homepage contains WordPress markers.');
  if (wp?.ok) notes.push('WordPress REST root is publicly reachable.');
  else notes.push('WordPress REST root was not confirmed; do not assume WordPress.');
  if (conventionalFeed) notes.push('A conventional RSS/Atom feed was validated.');
  else if (feed?.ok || rss?.ok) notes.push('Conventional feed paths returned HTTP success but did not validate as RSS/Atom; redirects to HTML are not counted as feeds.');
  if (sitemap) notes.push(`A sitemap endpoint is reachable at ${sitemap.url}.`);
  if (taxonomies.event?.length) notes.push('Event detail URLs are discoverable from public listings.');
  if (wordpress?.ok) notes.push('Custom WordPress REST collections and their taxonomies were probed directly for ingestion design.');

  return {
    available_endpoints: available,
    platform_hints: platformHints,
    conventional_feed_available: conventionalFeed,
    sitemap_available: Boolean(sitemap),
    wordpress_rest_available: Boolean(wp?.ok),
    wordpress_structured_collections_available: Boolean(wordpress?.ok),
    discovered_taxonomies: taxonomies,
    notes,
  };
}

const endpointResults = [];
for (const [name, path] of ENDPOINTS) endpointResults.push(await probeEndpoint(name, path));
const wordpress = await probeWordPressSchema();

const report = {
  generated_at: new Date().toISOString(),
  source: 'Ealing Culture',
  source_url: BASE,
  purpose: 'Read-only source discovery. No Ealing Culture records are persisted or republished by this probe.',
  summary: summarize(endpointResults, wordpress),
  wordpress,
  endpoints: Object.fromEntries(endpointResults.map((item) => [item.name, item])),
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Ealing Culture probe written to ${outputPath}`);
console.log(`Platform hints: ${report.summary.platform_hints.join(', ') || 'none detected'}`);
console.log(`WordPress REST: ${report.summary.wordpress_rest_available ? 'YES' : 'NO'}`);
console.log(`Structured WP collections: ${report.summary.wordpress_structured_collections_available ? 'YES' : 'NO'}`);
console.log(`Conventional feed: ${report.summary.conventional_feed_available ? 'YES' : 'NO'}`);
console.log(`Sitemap: ${report.summary.sitemap_available ? 'YES' : 'NO'}`);
if (wordpress.ok) {
  for (const [name, info] of Object.entries(wordpress.types)) {
    console.log(`${name.padEnd(10)} REST=${String(info.rest_base ?? '-').padEnd(14)} total=${info.total ?? '-'}`);
  }
}
for (const [key, values] of Object.entries(report.summary.discovered_taxonomies)) {
  if (values.length) console.log(`${key.padEnd(18)} ${values.length} discovered`);
}
if (verbose) {
  for (const note of report.summary.notes) console.log(`- ${note}`);
  for (const item of endpointResults) {
    const state = item.ok ? 'OK' : 'FAIL';
    console.log(`${state.padEnd(5)} ${item.name.padEnd(16)} ${item.status ?? ''} ${item.url}${item.error ? ` — ${item.error}` : ''}`);
  }
}

if (!report.endpoints.homepage.ok) process.exitCode = 2;
