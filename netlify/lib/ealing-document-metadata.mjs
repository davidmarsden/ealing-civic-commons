import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';

const STORE_NAME = 'ealing-council-document-metadata';
const FETCH_TIMEOUT_MS = 450;
const memoryCache = new Map();

const store = () => getStore(STORE_NAME);
const cacheKey = url => `page/${createHash('sha256').update(String(url)).digest('hex')}`;

const namedEntities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '£',
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

function strip(value = '') {
  return decodeEntities(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function useful(value, rawTitle) {
  const text = strip(value);
  if (!text || text.length < 8 || text.length > 280) return null;
  const lower = text.toLowerCase();
  const raw = strip(rawTitle).replace(/^downloads?\s*:\s*/i, '').toLowerCase();
  if (raw && lower === raw) return null;
  if (/^(download now|file type|size|ealing council)$/i.test(text)) return null;
  return text;
}

function metaDescription(html) {
  const patterns = [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i
  ];
  for (const pattern of patterns) {
    const match = String(html).match(pattern);
    if (match?.[1]) return strip(match[1]);
  }
  return null;
}

function bodyDescription(html, rawTitle) {
  const blocks = [...String(html).matchAll(/<(h[1-6]|p)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => ({ tag: match[1].toLowerCase(), text: strip(match[2]) }))
    .filter(block => block.text);
  const wanted = strip(rawTitle).replace(/^downloads?\s*:\s*/i, '').toLowerCase();
  if (!wanted) return null;
  const headingIndex = blocks.findIndex(block => block.tag.startsWith('h') && block.text.toLowerCase() === wanted);
  if (headingIndex < 0) return null;
  for (const block of blocks.slice(headingIndex + 1, headingIndex + 6)) {
    if (block.tag.startsWith('h')) break;
    const text = useful(block.text, rawTitle);
    if (text) return text;
  }
  return null;
}

function extractMetadata(html, rawTitle) {
  const description = bodyDescription(html, rawTitle) || useful(metaDescription(html), rawTitle);
  if (!description) return null;
  return { description };
}

function normaliseRecord(record) {
  if (!record?.description) return null;
  return { ...record, description: strip(record.description) };
}

export async function getEalingDocumentMetadata(url, rawTitle) {
  if (!url || !/^https:\/\/www\.ealing\.gov\.uk\/(?:download\/)?downloads\//i.test(url)) return null;
  const key = cacheKey(url);
  if (memoryCache.has(key)) return memoryCache.get(key);

  try {
    const cached = normaliseRecord(await store().get(key, { type: 'json', consistency: 'eventual' }));
    if (cached?.description) {
      memoryCache.set(key, cached);
      return cached;
    }
  } catch {
    // Cache failure must never block the live source.
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'en-GB,en;q=0.9',
        'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)'
      }
    });
    if (!response.ok) return null;
    const metadata = extractMetadata(await response.text(), rawTitle);
    if (!metadata) return null;
    const record = { ...metadata, resolvedAt: new Date().toISOString(), url };
    memoryCache.set(key, record);
    store().setJSON(key, record).catch(() => {});
    return record;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const EALING_DOCUMENT_METADATA_TIMEOUT_MS = FETCH_TIMEOUT_MS;
