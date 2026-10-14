// YouTube's feed endpoint only accepts a legacy username (`?user=`) or a channel
// ID (`?channel_id=UC…`). Channels created as @handles have no legacy username, so
// `?user=<handle>` returns 404. Sources therefore name the @handle, and the ingest
// resolves it to the channel ID from the channel page, caching the result.
const CHANNEL_ID = /^UC[\w-]{22}$/;
const RESOLVED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const memory = new Map();

export function channelIdFromPage(html = '') {
  const patterns = [
    /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})["']/i,
    /"externalId"\s*:\s*"(UC[\w-]{22})"/,
    /<meta\s+itemprop=["'](?:identifier|channelId)["']\s+content=["'](UC[\w-]{22})["']/i,
    /"channelId"\s*:\s*"(UC[\w-]{22})"/
  ];
  for (const pattern of patterns) {
    const id = String(html).match(pattern)?.[1];
    if (id && CHANNEL_ID.test(id)) return id;
  }
  return null;
}

export const channelFeedUrl = channelId => `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

// `cache` is a Blobs-like store ({ get, setJSON }); resolution still works without it.
export async function resolveYoutubeHandle(handle, { cache = null, fetchImpl = fetch, now = Date.now() } = {}) {
  const clean = String(handle || '').replace(/^@/, '').trim();
  if (!clean) throw new Error('YouTube handle missing');
  const key = `youtube/handle/${clean.toLowerCase()}`;
  const remembered = memory.get(key);
  if (remembered && now - remembered.resolvedAt < RESOLVED_TTL_MS) return remembered.channelId;
  const cached = cache ? await cache.get(key, { type: 'json' }).catch(() => null) : null;
  if (cached?.channelId && CHANNEL_ID.test(cached.channelId) && now - Date.parse(cached.resolvedAt) < RESOLVED_TTL_MS) {
    memory.set(key, { channelId: cached.channelId, resolvedAt: Date.parse(cached.resolvedAt) });
    return cached.channelId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetchImpl(`https://www.youtube.com/@${encodeURIComponent(clean)}`, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'text/html', 'accept-language': 'en-GB,en;q=0.9', cookie: 'CONSENT=YES+1', 'user-agent': 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)' }
    });
  } finally {
    clearTimeout(timeout);
  }
  // A cached ID stays usable if the channel page is temporarily unreachable.
  if (!response.ok) {
    if (cached?.channelId && CHANNEL_ID.test(cached.channelId)) return cached.channelId;
    throw new Error(`YouTube handle @${clean} could not be resolved: HTTP ${response.status}`);
  }
  const channelId = channelIdFromPage(await response.text());
  if (!channelId) {
    if (cached?.channelId && CHANNEL_ID.test(cached.channelId)) return cached.channelId;
    throw new Error(`YouTube handle @${clean} page fetched but no channel ID was found`);
  }
  memory.set(key, { channelId, resolvedAt: now });
  if (cache) await cache.setJSON(key, { handle: clean, channelId, resolvedAt: new Date(now).toISOString() }).catch(() => {});
  return channelId;
}
