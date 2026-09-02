import { getStore } from '@netlify/blobs';
import { STORE_NAME, itemBlobKey, validItemKey } from '../lib/civic-items.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60, stale-while-revalidate=300'
  }
});

const clean = (value, max = 180) => String(value ?? '').trim().slice(0, max);
const cleanList = (values, max = 180) => [...new Set((values || []).map(value => clean(value, max)).filter(value => value.length >= 3))].slice(0, 20);
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function sortTime(record) {
  const published = Date.parse(record?.item?.publishedAt || '');
  if (Number.isFinite(published)) return published;
  const archived = Date.parse(record?.archivedAt || '');
  return Number.isFinite(archived) ? archived : 0;
}

function termMatches(text, term) {
  if (term.length > 4) return text.includes(term);
  return new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(text);
}

function relevanceScore(record, terms, topics) {
  const item = record?.item;
  if (!item || item.sourceClass !== 'Journalism / publishing') return 0;

  let score = 0;
  const title = String(item.title || '').toLowerCase();
  const summary = String(item.summary || '').toLowerCase();
  const itemTopics = (item.topics || []).map(topic => String(topic).toLowerCase());

  if (topics.some(topic => itemTopics.includes(topic))) score += 5;

  for (const term of terms) {
    if (termMatches(title, term)) {
      score += 4;
      continue;
    }
    // Summary-only matches are deliberately weak. Generic one-word concepts
    // such as housing/planning/community cannot qualify from a passing mention.
    const usefulPhrase = term.includes(' ') || term.length >= 12;
    if (usefulPhrase && termMatches(summary, term)) score += 2;
  }

  return score;
}

export default async request => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(request.url);
  const terms = cleanList(url.searchParams.getAll('term'), 240).map(value => value.toLowerCase());
  const topics = cleanList(url.searchParams.getAll('topic')).map(value => value.toLowerCase());
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 20, 100));

  if (!terms.length && !topics.length) return json({ version: 1, count: 0, records: [] });

  try {
    const blobs = getStore(STORE_NAME, { consistency: 'strong' });
    const listed = await blobs.list({ prefix: 'item/' });
    const keys = listed.blobs
      .map(blob => String(blob.key || '').replace(/^item\//, ''))
      .filter(validItemKey);
    const records = [];
    const batchSize = 100;

    for (let cursor = 0; cursor < keys.length; cursor += batchSize) {
      const batch = keys.slice(cursor, cursor + batchSize);
      const loaded = await Promise.all(batch.map(key => blobs.get(itemBlobKey(key), { type: 'json' }).catch(() => null)));
      records.push(...loaded.filter(record => record?.item && validItemKey(record.key)));
    }

    const matching = records
      .map(record => ({ record, score: relevanceScore(record, terms, topics) }))
      .filter(entry => entry.score >= 4)
      .sort((a, b) => b.score - a.score || sortTime(b.record) - sortTime(a.record));

    return json({
      version: 1,
      count: matching.length,
      records: matching.slice(0, limit).map(({ record, score }) => ({
        key: record.key,
        archivedAt: record.archivedAt,
        matchScore: score,
        item: record.item
      }))
    });
  } catch (error) {
    console.error('Historical reporting lookup failed', error);
    return json({ error: 'Historical reporting is temporarily unavailable.' }, 503);
  }
};
