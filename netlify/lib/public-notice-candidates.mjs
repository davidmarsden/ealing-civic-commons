const BASE = 'https://publicnoticeportal.uk';
const CATEGORY_PAGES = [
  { slug: 'planning', label: 'Planning', topics: ['Planning & development'] },
  { slug: 'traffic', label: 'Traffic & Roads', topics: ['Transport'] },
  { slug: 'licensing', label: 'Alcohol & Licensing', topics: ['Council & democracy'] },
  { slug: 'statutory', label: 'Statutory', topics: ['Council & democracy'] }
];

const cleanText = value => String(value || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#0*39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

async function fetchText(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Ealing Civic Commons/0.1 (+https://commons.southallstories.uk/; public-interest metadata review)',
        accept: 'text/html,application/xhtml+xml'
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractNoticeLinks(html, category) {
  const found = new Map();
  const pattern = /<a\b[^>]*href=["']([^"']*\/notice\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    let url;
    try { url = new URL(match[1], BASE).href; } catch { continue; }
    if (!url.startsWith(`${BASE}/notice/`)) continue;
    const anchorText = cleanText(match[2]);
    if (!found.has(url)) found.set(url, { url, anchorText, category });
  }
  return [...found.values()];
}

function extractTitle(html, fallback = '') {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const title = cleanText(h1?.[1] || fallback);
  return title && title.length <= 500 ? title : title.slice(0, 500);
}

function extractPublishedAt(html) {
  const iso = html.match(/(?:datePublished|publishedAt)["']?\s*[:=]\s*["']([^"']+)["']/i)?.[1];
  if (iso && !Number.isNaN(Date.parse(iso))) return new Date(iso).toISOString();
  const shortDate = cleanText(html).match(/Published\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (!shortDate) return '';
  const [, day, month, rawYear] = shortDate;
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const parsed = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

async function enrichNotice(link) {
  try {
    const html = await fetchText(link.url, 3500);
    return {
      ...link,
      title: extractTitle(html, link.anchorText || `${link.category.label} public notice`),
      publishedAt: extractPublishedAt(html)
    };
  } catch {
    return {
      ...link,
      title: link.anchorText || `${link.category.label} public notice`,
      publishedAt: ''
    };
  }
}

export async function fetchEalingPublicNoticeCandidates({ limit = 16 } = {}) {
  const pageResults = await Promise.allSettled(CATEGORY_PAGES.map(async category => {
    const html = await fetchText(`${BASE}/latest/ealing/${category.slug}/index.html`);
    return extractNoticeLinks(html, category);
  }));

  const links = [];
  const seen = new Set();
  for (const result of pageResults) {
    if (result.status !== 'fulfilled') continue;
    for (const link of result.value) {
      if (seen.has(link.url)) continue;
      seen.add(link.url);
      links.push(link);
    }
  }

  const selected = links.slice(0, Math.max(1, Math.min(Number(limit) || 16, 30)));
  const notices = await Promise.all(selected.map(enrichNotice));
  return notices.filter(notice => notice.title && notice.url).map(notice => ({
    kind: 'evidence-suggestion',
    source: 'Public Notice Portal',
    dedupeKey: `public-notice|${notice.url}`,
    provenance: 'Current Ealing public-notice metadata discovered on Public Notice Portal (News Media Association). Queued for review only; the portal remains canonical.',
    payload: {
      title: notice.title,
      url: notice.url,
      noticeType: notice.category.label,
      area: 'London Borough of Ealing',
      topics: notice.category.topics,
      towns: [],
      publisher: 'Public Notice Portal',
      publishedAt: notice.publishedAt
    }
  }));
}
