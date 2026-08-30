const allowedHostSuffixes = [
  'london.gov.uk',
  'ealing.gov.uk',
  'ealing.moderngov.co.uk',
  'met.police.uk',
  'southallblacksisters.org.uk',
  'tmg-uk.org',
  'ealingfoe.org.uk',
  'warrenfarmnaturereserve.co.uk',
  'ealinglawcentre.org.uk',
  'ehcvs.org.uk',
  'citizensuk.org',
  'southallstories.uk'
];

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

function hostAllowed(hostname = '') {
  const host = String(hostname).toLowerCase().replace(/^www\./, '');
  return allowedHostSuffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
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

function documentType(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const extension = pathname.match(/\.([a-z0-9]+)$/)?.[1] || '';
    if (extension === 'pdf') return 'pdf';
    if (['doc', 'docx', 'odt', 'rtf'].includes(extension)) return 'document';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(extension)) return 'spreadsheet';
    if (['ppt', 'pptx', 'odp'].includes(extension)) return 'presentation';
    return null;
  } catch {
    return null;
  }
}

function usefulDocument(url) {
  try {
    const parsed = new URL(url);
    return hostAllowed(parsed.hostname) && Boolean(documentType(url));
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

  if (landing.protocol !== 'https:' || !hostAllowed(landing.hostname)) {
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
      const mediaType = documentType(href);
      links.push({ url: href, title: text || `Linked ${mediaType}`, mediaType });
      if (links.length >= 16) break;
    }

    return json(200, { landing: landing.href, links });
  } catch (error) {
    return json(502, { error: error?.message || String(error) });
  }
}
