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
    event: [],
    event_type: [],
    event_location: [],
    audience: [],
    news: [],
    news_category: [],
    creative: [],
    creative_category: [],
    creative_location: [],
    space: [],
    suitability: [],
    pagination: [],
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
    return {
      ok: response.ok,
      name,
      ...diagnostics,
      bytes: Buffer.byteLength(text),
      elapsed_ms: Date.now() - started,
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

function summarize(results) {
  const homepage = results.find((item) => item.name === 'homepage');
  const available = results.filter((item) => item.ok).map((item) => item.name);
  const wp = results.find((item) => item.name === 'wp_json');
  const feed = results.find((item) => item.name === 'feed');
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
  const notes = [];
  if (platformHints.includes('jadu')) notes.push('Homepage contains Jadu markers.');
  if (platformHints.includes('wordpress')) notes.push('Homepage contains WordPress markers.');
  if (wp?.ok) notes.push('WordPress REST root is publicly reachable.');
  else notes.push('WordPress REST root was not confirmed; do not assume WordPress.');
  if (feed?.ok) notes.push('A conventional /feed/ endpoint is reachable.');
  if (sitemap) notes.push(`A sitemap endpoint is reachable at ${sitemap.url}.`);
  if (taxonomies.event?.length) notes.push('Event detail URLs are discoverable from public listings.');
  if (taxonomies.creative_location?.length || taxonomies.event_type?.length || taxonomies.suitability?.length) notes.push('Public taxonomy/archive URLs are discoverable and can support structured fallback ingestion.');

  return {
    available_endpoints: available,
    platform_hints: platformHints,
    conventional_feed_available: Boolean(feed?.ok),
    sitemap_available: Boolean(sitemap),
    wordpress_rest_available: Boolean(wp?.ok),
    discovered_taxonomies: taxonomies,
    notes,
  };
}

const endpointResults = [];
for (const [name, path] of ENDPOINTS) endpointResults.push(await probeEndpoint(name, path));

const report = {
  generated_at: new Date().toISOString(),
  source: 'Ealing Culture',
  source_url: BASE,
  purpose: 'Read-only source discovery. No Ealing Culture records are persisted or republished by this probe.',
  summary: summarize(endpointResults),
  endpoints: Object.fromEntries(endpointResults.map((item) => [item.name, item])),
};

await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Ealing Culture probe written to ${outputPath}`);
console.log(`Platform hints: ${report.summary.platform_hints.join(', ') || 'none detected'}`);
console.log(`WordPress REST: ${report.summary.wordpress_rest_available ? 'YES' : 'NO'}`);
console.log(`Conventional feed: ${report.summary.conventional_feed_available ? 'YES' : 'NO'}`);
console.log(`Sitemap: ${report.summary.sitemap_available ? 'YES' : 'NO'}`);
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
