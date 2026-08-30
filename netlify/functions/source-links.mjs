const allowedHosts = new Set(['london.gov.uk', 'www.london.gov.uk']);

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=900'
  },
  body: JSON.stringify(body)
});

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function usefulDocument(url) {
  try {
    const parsed = new URL(url);
    if (!allowedHosts.has(parsed.hostname)) return false;
    return /\.pdf(?:$|[?#])/i.test(parsed.pathname + parsed.search + parsed.hash);
  } catch {
    return false;
  }
}

export async function handler(event) {
  const raw = event.queryStringParameters?.url;
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
    const response = await fetch(landing.href, {
      headers: { 'user-agent': 'Southall-Ealing-Civic-Commons/1.0 (+https://commons.southallstories.uk/)' },
      redirect: 'follow'
    });
    if (!response.ok) return json(response.status, { error: `Upstream HTTP ${response.status}` });

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
      links.push({ url: href, title: text || 'Linked PDF document', mediaType: 'pdf' });
      if (links.length >= 12) break;
    }

    return json(200, { landing: landing.href, links });
  } catch (error) {
    return json(502, { error: error?.message || String(error) });
  }
}
