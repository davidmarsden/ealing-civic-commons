const allowedHosts = new Set([
  'london.gov.uk', 'www.london.gov.uk',
  'ealing.gov.uk', 'www.ealing.gov.uk', 'ealing.moderngov.co.uk',
  'met.police.uk', 'www.met.police.uk',
  'southallblacksisters.org.uk', 'www.southallblacksisters.org.uk',
  'tmg-uk.org', 'www.tmg-uk.org',
  'ealingfoe.org.uk', 'www.ealingfoe.org.uk',
  'warrenfarmnaturereserve.co.uk', 'www.warrenfarmnaturereserve.co.uk',
  'ealinglawcentre.org.uk', 'www.ealinglawcentre.org.uk',
  'ehcvs.org.uk', 'www.ehcvs.org.uk',
  'citizensuk.org', 'www.citizensuk.org',
  'southallstories.uk', 'www.southallstories.uk',
  'commons.southallstories.uk'
]);

const youtubeFeeds = new Map([
  ['Ealing Council — YouTube', 'https://www.youtube.com/feeds/videos.xml?user=EalingCouncil'],
  ['Southall Black Sisters — YouTube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCUsEWqUfUJYr9uwLtXymxVA'],
  ['London Assembly — YouTube', 'https://www.youtube.com/feeds/videos.xml?user=LondonAssembly']
]);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=900'
  },
  body: JSON.stringify(body)
});

function decodeEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function cleanText(value = '') {
  return decodeEntities(String(value).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUrls(text = '') {
  const matches = decodeEntities(String(text)).match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(matches.map(url => url.replace(/[),.;!?]+$/g, '')))];
}

function absoluteUrl(href, base) {
  try {
    const url = new URL(href, base);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}

function mediaTypeFor(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.pdf$/i.test(pathname)) return 'pdf';
    if (/\.(doc|docx|odt|rtf)$/i.test(pathname)) return 'document';
    if (/\.(xls|xlsx|ods|csv)$/i.test(pathname)) return 'spreadsheet';
    if (/\.(ppt|pptx|odp)$/i.test(pathname)) return 'presentation';
    return null;
  } catch {
    return null;
  }
}

function usefulDocument(url) {
  try {
    const parsed = new URL(url);
    if (!allowedHosts.has(parsed.hostname)) return false;
    return Boolean(mediaTypeFor(url));
  } catch {
    return false;
  }
}

function youtubeVideoId(raw) {
  try {
    const url = new URL(raw);
    if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null;
    if (/(^|\.)youtube\.com$/i.test(url.hostname)) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      const parts = url.pathname.split('/').filter(Boolean);
      const marker = parts.findIndex(part => ['shorts', 'live', 'embed'].includes(part));
      if (marker >= 0) return parts[marker + 1] || null;
    }
  } catch {}
  return null;
}

async function youtubeDescriptionLinks(sourceUrl, sourceName) {
  const videoId = youtubeVideoId(sourceUrl);
  const feedUrl = youtubeFeeds.get(sourceName);
  if (!videoId || !feedUrl) return [];

  const response = await fetch(feedUrl, {
    headers: { 'user-agent': 'Southall-Ealing-Civic-Commons/1.0 (+https://commons.southallstories.uk/)' },
    redirect: 'follow'
  });
  if (!response.ok) return [];

  const xml = await response.text();
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  const entry = entries.find(block => new RegExp(`<yt:videoId>\\s*${videoId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/yt:videoId>`, 'i').test(block));
  if (!entry) return [];

  const descriptionMatch = /<media:description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/media:description>/i.exec(entry);
  if (!descriptionMatch) return [];
  return extractUrls(descriptionMatch[1]);
}

async function linkedDocuments(landing) {
  const response = await fetch(landing.href, {
    headers: { 'user-agent': 'Southall-Ealing-Civic-Commons/1.0 (+https://commons.southallstories.uk/)' },
    redirect: 'follow'
  });
  if (!response.ok) return { status: response.status, links: [] };

  const html = await response.text();
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const href = absoluteUrl(match[1], landing.href);
    if (!href || !usefulDocument(href) || seen.has(href)) continue;
    seen.add(href);
    const text = cleanText(match[2]);
    links.push({ url: href, title: text || 'Linked document', mediaType: mediaTypeFor(href) });
    if (links.length >= 12) break;
  }
  return { status: 200, links };
}

export async function handler(event) {
  const raw = event.queryStringParameters?.url;
  const sourceUrl = event.queryStringParameters?.sourceUrl;
  const sourceName = event.queryStringParameters?.sourceName || '';

  if (sourceUrl && youtubeVideoId(sourceUrl)) {
    try {
      const sourceLinks = await youtubeDescriptionLinks(sourceUrl, sourceName);
      return json(200, { sourceUrl, sourceLinks, links: [] });
    } catch (error) {
      return json(502, { error: error?.message || String(error), sourceLinks: [], links: [] });
    }
  }

  if (!raw) return json(400, { error: 'Missing url' });

  let landing;
  try {
    landing = new URL(raw);
  } catch {
    return json(400, { error: 'Invalid url' });
  }

  if (landing.protocol !== 'https:' || !allowedHosts.has(landing.hostname)) {
    return json(400, { error: 'Unsupported source host' });
  }

  try {
    const result = await linkedDocuments(landing);
    if (result.status !== 200) return json(result.status, { error: `Upstream HTTP ${result.status}` });
    return json(200, { landing: landing.href, links: result.links });
  } catch (error) {
    return json(502, { error: error?.message || String(error) });
  }
}
