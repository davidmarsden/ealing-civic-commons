const escapeHtml = value => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[char]));

function extractUrls(text = '') {
  const matches = String(text).match(/https?:\/\/[^\s<>"']+/gi) || [];
  return [...new Set(matches.map(url => url.replace(/[),.;!?]+$/g, '')))];
}

function classifyDirectUrl(url) {
  try {
    const parsed = new URL(url);
    if (/\.pdf$/i.test(parsed.pathname)) return 'Linked PDF';
    if (/(^|\.)london\.gov\.uk$/i.test(parsed.hostname)) return 'Assembly publication page';
    return 'Linked source';
  } catch {
    return 'Linked source';
  }
}

function documentLabel(link) {
  const text = String(link.title || '').trim();
  if (/infographic/i.test(text) || /infographic/i.test(link.url)) return 'Infographic (PDF)';
  if (/report|hot property|publication/i.test(text)) return 'Full report (PDF)';
  return text ? `${text} (PDF)` : 'Linked PDF document';
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

async function renderSourceLinks() {
  const view = document.querySelector('#itemView');
  if (!view || view.hidden) return false;
  if (view.querySelector('.source-links-panel')) return true;

  const summary = view.querySelector('.item-page-summary')?.textContent || '';
  const directUrls = extractUrls(summary);
  if (!directUrls.length) return true;

  const landingUrls = directUrls.filter(url => {
    try {
      const parsed = new URL(url);
      return /(^|\.)london\.gov\.uk$/i.test(parsed.hostname) && !/\.pdf$/i.test(parsed.pathname);
    } catch {
      return false;
    }
  });

  const discovered = (await Promise.all(landingUrls.slice(0, 3).map(enrichLandingPage))).flat();
  const seen = new Set(directUrls);
  const extraDocuments = discovered.filter(link => link?.url && !seen.has(link.url) && (seen.add(link.url), true));

  const panel = document.createElement('section');
  panel.className = 'source-links-panel';
  panel.setAttribute('aria-labelledby', 'sourceLinksTitle');
  panel.innerHTML = `<p class="eyebrow">Source links</p><h2 id="sourceLinksTitle">Follow the source trail</h2><p class="source-links-intro">The video remains the original source. These links were supplied in its description or found on the official publication page it points to.</p><div class="source-links-grid"><div><strong>Linked from the source description</strong><ul>${directUrls.map(url => row(classifyDirectUrl(url), url)).join('')}</ul></div>${extraDocuments.length ? `<div><strong>Documents on the linked publication page</strong><ul>${extraDocuments.map(link => row(documentLabel(link), link.url, link.title && !/report|infographic|hot property/i.test(link.title) ? link.title : '')).join('')}</ul></div>` : ''}</div>`;

  const actions = view.querySelector('.item-page-actions');
  if (actions) view.insertBefore(panel, actions);
  else view.appendChild(panel);
  return true;
}

let attempts = 0;
const timer = setInterval(async () => {
  attempts += 1;
  if (await renderSourceLinks() || attempts > 30) clearInterval(timer);
}, 150);
