#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = 'https://ealingculture.org/';
const SOURCE_ID = 'ealing-culture';
const SOURCE_NAME = 'Ealing Culture';
const SOURCE_OWNER = 'London Borough of Ealing';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const TARGET_TYPES = ['event', 'news', 'venue', 'creative'];
const REQUIRED_TYPES = ['event', 'news'];
const COMMONS_TOWNS = ['acton', 'ealing', 'greenford', 'hanwell', 'northolt', 'perivale', 'southall'];

const outputArg = process.argv.find((value) => value.startsWith('--output='));
const outputPath = resolve(outputArg ? outputArg.slice('--output='.length) : 'ealing-culture-ingest.json');

function decodeEntities(value = '') {
  return String(value)
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripHtml(value = '') {
  return decodeEntities(String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function slugify(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stableHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 20);
}

function wpGmtInstant(value, fallback = null) {
  if (!value) return fallback || null;
  const raw = String(value).trim();
  if (!raw) return fallback || null;
  const explicit = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const parsed = new Date(explicit);
  return Number.isNaN(parsed.getTime()) ? (fallback || raw) : parsed.toISOString();
}

function restUrl(namespace, restBase) {
  const cleanNamespace = String(namespace || 'wp/v2').replace(/^\/+|\/+$/g, '');
  const cleanBase = String(restBase).replace(/^\/+|\/+$/g, '');
  return new URL(`/wp-json/${cleanNamespace}/${cleanBase}`, BASE);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json',
      'accept-language': 'en-GB,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${response.url}`);
  try {
    return { response, json: JSON.parse(text) };
  } catch {
    throw new Error(`Expected JSON from ${response.url}`);
  }
}

async function fetchAllCollection(namespace, restBase) {
  const rows = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = restUrl(namespace, restBase);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    url.searchParams.set('_embed', '1');
    const { response, json } = await fetchJson(url);
    if (!Array.isArray(json)) throw new Error(`Expected array from ${url}`);
    rows.push(...json);
    totalPages = Number(response.headers.get('x-wp-totalpages') || 1);
    page += 1;
  } while (page <= totalPages);
  return rows;
}

function termMap(rows = []) {
  return new Map(rows.map((row) => [Number(row.id), {
    id: Number(row.id), name: row.name ?? null, slug: row.slug ?? null,
    count: row.count ?? null, link: row.link ?? null,
  }]));
}

async function loadSchemaAndTerms(warnings) {
  const [{ json: types }, { json: taxonomies }] = await Promise.all([
    fetchJson(new URL('/wp-json/wp/v2/types', BASE)),
    fetchJson(new URL('/wp-json/wp/v2/taxonomies', BASE)),
  ]);

  const typeDefs = {};
  for (const typeName of TARGET_TYPES) {
    const type = types[typeName];
    if (!type) {
      warnings.push(`type_unavailable:${typeName}`);
      continue;
    }
    typeDefs[typeName] = type;
  }

  const relevantTaxonomies = [...new Set(Object.values(typeDefs).flatMap((type) => type.taxonomies ?? []))];
  const taxonomyTerms = {};
  for (const taxonomyName of relevantTaxonomies) {
    const taxonomy = taxonomies[taxonomyName];
    if (!taxonomy) {
      warnings.push(`taxonomy_schema_unavailable:${taxonomyName}`);
      continue;
    }
    try {
      const rows = await fetchAllCollection(taxonomy.rest_namespace || 'wp/v2', taxonomy.rest_base || taxonomyName);
      taxonomyTerms[taxonomyName] = termMap(rows);
    } catch (error) {
      warnings.push(`taxonomy_fetch_failed:${taxonomyName}:${error instanceof Error ? error.message : String(error)}`);
      taxonomyTerms[taxonomyName] = new Map();
    }
  }

  return { typeDefs, taxonomyTerms };
}

function collectTaxonomyTerms(row, typeDef, taxonomyTerms, parseWarnings) {
  const result = {};
  for (const taxonomyName of typeDef?.taxonomies ?? []) {
    const raw = row[taxonomyName];
    const ids = Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
    const map = taxonomyTerms[taxonomyName];
    result[taxonomyName] = ids.map((id) => map?.get(id)).filter(Boolean);
    if (ids.length && !map?.size) parseWarnings?.push(`taxonomy_terms_unavailable:${taxonomyName}`);
  }
  return result;
}

function recursiveCandidates(row) {
  return [row, row?.acf, row?.meta].filter((value) => value && typeof value === 'object' && !Array.isArray(value));
}

function firstValue(row, names) {
  const wanted = names.map((name) => String(name).toLowerCase().replace(/[^a-z0-9]/g, ''));
  for (const root of recursiveCandidates(row)) {
    for (const [key, value] of Object.entries(root)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!wanted.includes(normalized) || value === '' || value == null) continue;
      if (typeof value === 'object' && value?.rendered != null) return value.rendered;
      return value;
    }
  }
  return null;
}

function asText(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ') || null;
  if (typeof value === 'object') {
    if (value.rendered != null) return stripHtml(value.rendered) || null;
    if (value.address != null) return asText(value.address);
    if (value.name != null) return asText(value.name);
    return null;
  }
  return stripHtml(value) || null;
}

function taxonomyNames(taxonomies, name) {
  return (taxonomies[name] ?? []).map((term) => term.name).filter(Boolean);
}

function normalizeTown(sourceTown) {
  const raw = String(sourceTown || '').trim();
  const slug = slugify(raw);
  if (!slug) return { source: raw || null, commons_town: null, scope: 'unknown', warnings: ['town_missing'] };
  if (COMMONS_TOWNS.includes(slug)) return { source: raw, commons_town: slug, scope: 'town', warnings: [] };
  if (slug === 'boroughwide' || slug === 'borough-wide' || slug === 'all-ealing') return { source: raw, commons_town: null, scope: 'boroughwide', warnings: [] };
  if (slug === 'park-royal') return { source: raw, commons_town: null, scope: 'cross-boundary', warnings: ['park_royal_cross_boundary'] };
  return { source: raw, commons_town: null, scope: 'other', warnings: ['town_unmapped'] };
}

function addressTownConflict(sourceTown, address) {
  const normalized = slugify(sourceTown);
  if (!COMMONS_TOWNS.includes(normalized) || !address) return null;
  const lower = String(address).toLowerCase();
  const found = COMMONS_TOWNS.filter((town) => new RegExp(`\\b${town}\\b`, 'i').test(lower));
  const conflicting = found.filter((town) => town !== normalized);
  return conflicting.length ? conflicting : null;
}

function sourceMeta(row) {
  return {
    source_id: SOURCE_ID,
    source_name: SOURCE_NAME,
    source_owner: SOURCE_OWNER,
    source_kind: 'official',
    source_url: row.link ?? BASE,
    source_record_id: row.id ?? null,
    source_modified: wpGmtInstant(row.modified_gmt, row.modified ?? null),
  };
}

function baseRecord(row, kind, taxonomies) {
  const title = stripHtml(row.title?.rendered ?? row.title ?? '') || null;
  const body = stripHtml(row.content?.rendered ?? '');
  const summary = stripHtml(row.excerpt?.rendered ?? '') || null;
  return {
    id: `${kind}:ealing-culture:${row.id}`,
    kind,
    title,
    summary,
    body,
    published_at: wpGmtInstant(row.date_gmt, row.date ?? null),
    updated_at: wpGmtInstant(row.modified_gmt, row.modified ?? null),
    canonical_url: row.link ?? null,
    taxonomies,
    provenance: sourceMeta(row),
    parse_warnings: [],
  };
}

function normalizeEvent(row, typeDef, taxonomyTerms) {
  const parseWarnings = [];
  const taxonomies = collectTaxonomyTerms(row, typeDef, taxonomyTerms, parseWarnings);
  const record = baseRecord(row, 'event', taxonomies);
  record.parse_warnings.push(...parseWarnings);
  const sourceTown = taxonomyNames(taxonomies, 'town')[0] ?? asText(firstValue(row, ['town', 'location_town', 'event_town']));
  const town = normalizeTown(sourceTown);
  const address = asText(firstValue(row, ['location', 'address', 'venue_address', 'event_location', 'full_address']));
  const eventDate = asText(firstValue(row, ['event_date', 'date_of_event', 'eventdate', 'date_display', 'event_dates', 'first_day_of_this_event']));
  const eventTime = asText(firstValue(row, ['event_time', 'time', 'eventtime']));
  const cost = asText(firstValue(row, ['cost', 'price', 'event_cost']));
  const externalUrl = asText(firstValue(row, ['website', 'website_url', 'external_url', 'social_media_link', 'event_url']));
  const conflict = addressTownConflict(sourceTown, address);

  record.event = {
    date_text: eventDate,
    time_text: eventTime,
    cost_text: cost,
    address,
    external_url: externalUrl,
    audience: taxonomyNames(taxonomies, 'audience'),
    event_types: taxonomyNames(taxonomies, 'event-type'),
    town,
  };
  record.parse_warnings.push(...town.warnings);
  if (!eventDate) record.parse_warnings.push('event_date_not_exposed_as_structured_field');
  if (!address) record.parse_warnings.push('event_address_not_exposed_as_structured_field');
  if (conflict) record.parse_warnings.push(`town_address_conflict:${conflict.join(',')}`);

  const fingerprint = ['event', record.title, eventDate, sourceTown, address].map((value) => String(value || '').toLowerCase().trim()).join('|');
  record.dedupe = { source_key: `${SOURCE_ID}:event:${row.id}`, canonical_url: record.canonical_url, fingerprint: stableHash(fingerprint) };
  return record;
}

function normalizeNews(row, typeDef, taxonomyTerms) {
  const parseWarnings = [];
  const taxonomies = collectTaxonomyTerms(row, typeDef, taxonomyTerms, parseWarnings);
  const record = baseRecord(row, 'news', taxonomies);
  record.parse_warnings.push(...parseWarnings);
  const sourceTown = taxonomyNames(taxonomies, 'town')[0] ?? asText(firstValue(row, ['town', 'location_town']));
  const town = normalizeTown(sourceTown);
  if (sourceTown) record.geography = town;
  record.categories = taxonomyNames(taxonomies, 'news-category');
  record.parse_warnings.push(...(sourceTown ? town.warnings : []));
  const fingerprint = ['news', record.title, record.published_at, sourceTown].map((value) => String(value || '').toLowerCase().trim()).join('|');
  record.dedupe = { source_key: `${SOURCE_ID}:news:${row.id}`, canonical_url: record.canonical_url, fingerprint: stableHash(fingerprint) };
  return record;
}

function normalizeReference(row, typeName, typeDef, taxonomyTerms) {
  const parseWarnings = [];
  const taxonomies = collectTaxonomyTerms(row, typeDef, taxonomyTerms, parseWarnings);
  const title = stripHtml(row.title?.rendered ?? row.title ?? '') || null;
  const content = stripHtml(row.content?.rendered ?? '');
  const excerpt = stripHtml(row.excerpt?.rendered ?? '');
  const description = content || excerpt || null;
  const locationTaxonomy = typeName === 'venue' ? 'venue-town' : 'creative---location';
  const sourceLocations = taxonomyNames(taxonomies, locationTaxonomy);
  const locations = sourceLocations.map((source) => normalizeTown(source));
  const primaryGeography = locations[0] ?? null;
  const reference = {
    id: `reference:ealing-culture:${typeName}:${row.id}`,
    reference_type: typeName,
    title,
    description,
    canonical_url: row.link ?? null,
    taxonomies,
    geography: primaryGeography,
    geographies: locations,
    provenance: sourceMeta(row),
    promotion_policy: typeName === 'creative'
      ? 'reference-only; do not auto-create civic person profiles'
      : 'reference-only until entity matching/promotion rules are applied',
    parse_warnings: [...parseWarnings, ...locations.flatMap((location) => location.warnings)],
  };
  reference.dedupe = {
    source_key: `${SOURCE_ID}:${typeName}:${row.id}`,
    canonical_url: reference.canonical_url,
    fingerprint: stableHash([typeName, title, ...sourceLocations].join('|').toLowerCase()),
  };
  return reference;
}

const result = {
  generated_at: new Date().toISOString(),
  purpose: 'Normalized Ealing Culture ingestion preview. Events and news are Commons-ready candidate items; venues and creatives remain reference-only. No records are persisted to Civic Commons storage by this script.',
  source: { id: SOURCE_ID, name: SOURCE_NAME, owner: SOURCE_OWNER, kind: 'official', url: BASE },
  ok: false,
  counts: {},
  items: { events: [], news: [] },
  references: { venues: [], creatives: [] },
  warnings: [],
  errors: [],
};

try {
  const { typeDefs, taxonomyTerms } = await loadSchemaAndTerms(result.warnings);
  const raw = {};

  for (const typeName of TARGET_TYPES) {
    const type = typeDefs[typeName];
    if (!type) {
      raw[typeName] = [];
      continue;
    }
    try {
      raw[typeName] = await fetchAllCollection(type.rest_namespace || 'wp/v2', type.rest_base || typeName);
    } catch (error) {
      raw[typeName] = [];
      const message = error instanceof Error ? error.message : String(error);
      if (REQUIRED_TYPES.includes(typeName)) result.errors.push(`collection_fetch_failed:${typeName}:${message}`);
      else result.warnings.push(`reference_collection_fetch_failed:${typeName}:${message}`);
    }
  }

  result.items.events = raw.event.map((row) => normalizeEvent(row, typeDefs.event, taxonomyTerms));
  result.items.news = raw.news.map((row) => normalizeNews(row, typeDefs.news, taxonomyTerms));
  result.references.venues = raw.venue.map((row) => normalizeReference(row, 'venue', typeDefs.venue, taxonomyTerms));
  result.references.creatives = raw.creative.map((row) => normalizeReference(row, 'creative', typeDefs.creative, taxonomyTerms));

  result.counts = {
    events: result.items.events.length,
    news: result.items.news.length,
    venues: result.references.venues.length,
    creatives: result.references.creatives.length,
    event_warnings: result.items.events.reduce((sum, row) => sum + row.parse_warnings.length, 0),
    news_warnings: result.items.news.reduce((sum, row) => sum + row.parse_warnings.length, 0),
    ingest_warnings: result.warnings.length,
  };

  result.ok = result.counts.events > 0 && result.counts.news > 0 && result.errors.length === 0;
  if (!result.counts.events) result.errors.push('Expected non-empty event collection');
  if (!result.counts.news) result.errors.push('Expected non-empty news collection');
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`Ealing Culture ingest preview written to ${outputPath}`);
console.log(`Status: ${result.ok ? 'OK' : 'FAIL'}`);
console.log(`Events: ${result.counts.events ?? 0}`);
console.log(`News: ${result.counts.news ?? 0}`);
console.log(`Venues (reference): ${result.counts.venues ?? 0}`);
console.log(`Creatives (reference): ${result.counts.creatives ?? 0}`);
console.log(`Event warnings: ${result.counts.event_warnings ?? 0}`);
console.log(`News warnings: ${result.counts.news_warnings ?? 0}`);
console.log(`Ingest warnings: ${result.counts.ingest_warnings ?? result.warnings.length}`);
for (const warning of result.warnings) console.warn(`- WARN ${warning}`);
for (const error of result.errors) console.error(`- ERROR ${error}`);
if (!result.ok) process.exitCode = 2;
