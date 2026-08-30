const escapeHtml = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[char]));

let renderState = 'idle';

function extractUrls(text = '') {
  const matches = String(text).match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(matches.map(url => url.replace(/[),.;!?]+$/g, '')))];
}

function classifyDirectUrl(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (/\.pdf$/i.test(pathname)) return 'Linked PDF';
    if (/\.(doc|docx|odt|rtf)$/i.test(pathname)) return 'Linked document';
    if (/\.(xls|xlsx|ods|csv)$/i.test(pathname)) return 'Linked spreadsheet';
    if (/\.(ppt|pptx|odp)$/i.test(pathname)) return 'Linked presentation';
    return 'Linked source page';
  } catch {
    return 'Linked source';
  }
}

function documentLabel(link) {
  const text = String(link.title || '').trim();
  const type = String(link.mediaType || '').toLowerCase();
  if (/infographic/i.test(text) || /infographic/i.test(link.url)) return type === 'pdf' ? 'Infographic (PDF)' : 'Infographic';
  if (/report|publication/i.test(text)) return type === 'pdf' ? 'Full report (PDF)' : text;
  const suffix = type === 'pdf' ? 'PDF' : type === 'spreadsheet' ? 'spreadsheet' : type === 'presentation' ? 'presentation' : 'document';
  return text ? `${text} (${suffix})` : `Linked ${suffix}`;
}

function row(label, url, meta = '') {
  return `<li><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>${meta ? `<span>${escapeHtml(meta)}</span>` : ''}</li>`;
}

async function enrichLandingPage(url) {
  try {
    const endpoint = new URL('/.netlify/functions/source-links', location.origin);
    endpoint.searchParams.set('url', url);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return data.links || [];
  } catch {
    return [];
  }
}

async function recoverSourceDescriptionLinks(view) {
  try {
    const sourceUrl = view.querySelector('.primary-source-link')?.href;
    const meta = [...view.querySelectorAll('.item-page-meta span')].map(node => node.textContent.trim());
    const sourceName = meta[1] || '';
    if (!sourceUrl) return [];
    const endpoint = new URL('/.netlify/functions/source-links', location.origin);
    endpoint.searchParams.set('sourceUrl', sourceUrl);
    endpoint.searchParams.set('sourceName', sourceName);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return data.sourceLinks || [];
  } catch {
    return [];
  }
}

function isDocumentUrl(url) {
  try {
    return /\.(pdf|doc|docx|odt|rtf|xls|xlsx|ods|csv|ppt|pptx|odp)$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function preferCompleteUrls(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  return unique.filter(candidate => !unique.some(other => other !== candidate && other.startsWith(candidate) && other.length > candidate.length));
}

async function renderSourceLinks() {
  const view = document.querySelector('#itemView');
  if (!view || view.hidden) return false;
  if (view.querySelector('.source-links-panel')) { renderState = 'done'; return true; }
  if (renderState === 'loading') return false;
  if (renderState === 'done') return true;

  renderState = 'loading';
  try {
    const summary = view.querySelector('.item-page-summary')?.textContent || '';
    const visibleUrls = extractUrls(summary);
    const recoveredUrls = await recoverSourceDescriptionLinks(view);
    const directUrls = preferCompleteUrls([...visibleUrls, ...recoveredUrls]);
    if (!directUrls.length) { renderState = 'done'; return true; }

    const landingUrls = directUrls.filter(url => !isDocumentUrl(url));
    const discovered = (await Promise.all(landingUrls.slice(0, 4).map(enrichLandingPage))).flat();
    const seen = new Set(directUrls);
    const extraDocuments = discovered.filter(link => link?.url && !seen.has(link.url) && (seen.add(link.url), true));

    if (view.querySelector('.source-links-panel')) { renderState = 'done'; return true; }

    const panel = document.createElement('section');
    panel.className = 'source-links-panel';
    panel.setAttribute('aria-labelledby', 'sourceLinksTitle');
    panel.innerHTML = `<p class="eyebrow">Source links</p><h2 id="sourceLinksTitle">Follow the source trail</h2><p class="source-links-intro">The original item remains canonical. These links were supplied by that source, or discovered one step deeper on a recognised civic or publisher page it explicitly links to.</p><div class="source-links-grid"><div><strong>Linked from the source</strong><ul>${directUrls.map(url => row(classifyDirectUrl(url), url)).join('')}</ul></div>${extraDocuments.length ? `<div><strong>Documents on linked source pages</strong><ul>${extraDocuments.map(link => row(documentLabel(link), link.url, link.title || '')).join('')}</ul></div>` : ''}</div>`;

    const actions = view.querySelector('.item-page-actions');
    if (actions) view.insertBefore(panel, actions);
    else view.appendChild(panel);
    renderState = 'done';
    return true;
  } catch (error) {
    console.warn('Source trail unavailable', error);
    renderState = 'idle';
    return false;
  }
}

let attempts = 0;
const timer = setInterval(async () => {
  attempts += 1;
  if (await renderSourceLinks() || attempts > 30) clearInterval(timer);
}, 150);
