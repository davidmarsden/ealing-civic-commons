const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const pillClass = type => type === 'Official record' ? 'official' : type === 'Journalism / publishing' ? 'journalism' : type === 'Independent civic data / analysis' ? 'analysis' : 'organisation';
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};
const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function canonicalUrl(value) {
  try {
    const url = new URL(value, location.origin);
    url.hash = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return String(value || '').trim();
  }
}

function termMatches(text, term) {
  const haystack = String(text || '').toLowerCase();
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return false;
  if (needle.length > 4) return haystack.includes(needle);
  return new RegExp(`\\b${escapeRegex(needle)}\\b`, 'i').test(haystack);
}

function scoreItem(item, terms, topics) {
  let score = 0;
  const title = String(item?.title || '').toLowerCase();
  const summary = String(item?.summary || '').toLowerCase();
  const itemTopics = (item?.topics || []).map(topic => String(topic).toLowerCase());
  const wantedTopics = topics.map(topic => String(topic).toLowerCase());

  if (wantedTopics.some(topic => itemTopics.includes(topic))) score += 5;

  for (const rawTerm of terms) {
    const term = String(rawTerm || '').trim().toLowerCase();
    if (term.length < 3) continue;
    if (termMatches(title, term)) {
      score += 4;
      continue;
    }
    const usefulPhrase = term.includes(' ') || term.length >= 12;
    if (usefulPhrase && termMatches(summary, term)) score += 2;
  }
  return score;
}

function selectCurrent(items, terms, topics, limit = 8) {
  return (items || [])
    .map(item => ({ item, score: scoreItem(item, terms, topics) }))
    .filter(entry => entry.score >= 4)
    .sort((a, b) => b.score - a.score || (Date.parse(b.item.publishedAt || '') || 0) - (Date.parse(a.item.publishedAt || '') || 0))
    .slice(0, limit)
    .map(entry => entry.item);
}

function mergeHistorical(reviewed, archived, currentUrls) {
  const seen = new Set(currentUrls);
  const combined = [];
  const add = item => {
    const key = canonicalUrl(item?.url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    combined.push(item);
  };

  (reviewed || []).forEach(post => add({
    ...post,
    source: post.source || 'Southall Stories',
    date: post.date || post.publishedAt || null,
    reviewedMatch: true
  }));

  (archived || []).slice(0, 20).forEach(record => {
    const item = record?.item;
    if (!item?.url) return;
    add({
      title: item.title,
      url: item.url,
      summary: item.summary,
      date: item.publishedAt || record.archivedAt,
      source: item.source || 'Archived publisher',
      archivedMatch: true,
      matchScore: record.matchScore || null
    });
  });

  return combined.sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
}

function routeContext() {
  const parts = location.pathname.split('/').filter(Boolean);
  const segment = parts[0];
  const slug = parts[1]?.replace(/\.html$/, '');
  if (!slug) return null;
  if (['people','organisations','places'].includes(segment)) return { kind:'entity', route:`${segment}/${slug}`, segment, slug };
  if (segment === 'issues') return { kind:'issue', route:`issues/${slug}`, segment, slug };
  if (segment === 'topics') return { kind:'topic', route:`topics/${slug}`, segment, slug };
  return null;
}

async function fetchContext(route) {
  const endpointName = route.kind === 'entity' ? 'civic-entity' : route.kind === 'issue' ? 'civic-issue' : 'civic-topic';
  const endpoint = new URL(`/.netlify/functions/${endpointName}`, location.origin);
  endpoint.searchParams.set('route', route.route);
  const response = await fetch(endpoint, { cache:'no-store' });
  if (!response.ok) throw new Error(`${endpointName} HTTP ${response.status}`);
  return response.json();
}

function termsAndTopics(route, data) {
  if (route.kind === 'entity') return { terms:[data.entity?.name, ...(data.entity?.aliases || [])].filter(Boolean), topics:[] };
  if (route.kind === 'issue') return { terms:[data.issue?.name, ...(data.issue?.aliases || [])].filter(Boolean), topics:[] };
  return { terms:[data.topic?.name, ...(data.topic?.aliases || [])].filter(Boolean), topics:data.feedTopics || [] };
}

async function fetchHistorical(terms, topics) {
  const endpoint = new URL('/.netlify/functions/historical-reporting', location.origin);
  [...new Set(terms)].slice(0, 20).forEach(term => endpoint.searchParams.append('term', term));
  [...new Set(topics)].slice(0, 20).forEach(topic => endpoint.searchParams.append('topic', topic));
  endpoint.searchParams.set('limit', '20');
  const response = await fetch(endpoint, { cache:'no-store' });
  if (!response.ok) return [];
  return (await response.json()).records || [];
}

function roots(route) {
  if (route.kind === 'entity') return { current:'#currentItems', currentSection:'#currentSection', reporting:'#reporting', reportingSection:'#reportingSection', stats:'#entityStats .entity-stat:first-child strong' };
  if (route.kind === 'issue') return { current:'#currentItems', currentSection:'#currentSection', reporting:'#issueReporting', reportingSection:'#reportingSection', stats:'#issueStats .entity-stat:last-child strong' };
  return { current:'#currentItems', currentSection:'#currentSection', reporting:'#topicReporting', reportingSection:'#reportingSection', stats:'#topicStats .entity-stat:first-child strong' };
}

function renderCurrent(route, items) {
  const ids = roots(route);
  const root = document.querySelector(ids.current);
  const section = document.querySelector(ids.currentSection);
  if (!root || !section) return;
  if (!items.length) {
    section.hidden = true;
    root.innerHTML = '';
    return;
  }
  section.hidden = false;
  root.innerHTML = items.map(item => `<article class="item"><div class="item-meta"><span class="source-pill ${pillClass(item.sourceClass)}">${esc(item.sourceClass)}</span><strong>${esc(item.source)}</strong><span>${esc(fmtDate(item.publishedAt))}</span></div><div><h3><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h3>${item.summary ? `<p class="item-summary">${esc(item.summary)}</p>` : ''}</div></article>`).join('');
}

function renderHistorical(route, items) {
  const ids = roots(route);
  const root = document.querySelector(ids.reporting);
  const section = document.querySelector(ids.reportingSection);
  if (!root || !section) return;
  const stat = document.querySelector(ids.stats);
  if (stat) stat.textContent = String(items.length);
  if (!items.length) {
    section.hidden = true;
    root.innerHTML = '';
    return;
  }
  section.hidden = false;
  root.innerHTML = `<ul class="entity-list">${items.map(post => `<li><h3><a href="${esc(post.url)}" target="_blank" rel="noopener noreferrer">${esc(post.title)}</a></h3>${post.summary ? `<p>${esc(post.summary)}</p>` : ''}<span class="entity-meta">${esc(post.source || 'Publisher')} · ${esc(fmtDate(post.date))}${post.reviewedMatch ? ' · reviewed match' : ' · Civic Archive match'}</span></li>`).join('')}</ul>`;
}

function renderPrimaryIssueHub(route, issue) {
  const current = document.querySelector('#currentSection');
  const reporting = document.querySelector('#reportingSection');
  if (current) current.hidden = true;
  if (reporting) reporting.hidden = true;

  const stats = document.querySelector('#entityStats .entity-stat:first-child');
  if (stats) stats.innerHTML = '<strong>1</strong><span>main civic issue</span>';

  document.querySelectorAll('#entityHero .entity-actions a[href="#currentSection"], #entityHero .entity-actions a[href="#reportingSection"]').forEach(link => link.remove());
  const actions = document.querySelector('#entityHero .entity-actions');
  if (actions && !actions.querySelector('[data-primary-issue-link]')) {
    actions.insertAdjacentHTML('beforeend', `<a data-primary-issue-link href="/${esc(issue.route)}">Main civic issue →</a>`);
  }

  if (document.querySelector('#primaryIssueHub')) return;
  const section = document.createElement('section');
  section.id = 'primaryIssueHub';
  section.className = 'entity-section';
  section.innerHTML = `<p class="eyebrow">Main civic issue</p><h2><a href="/${esc(issue.route)}">${esc(issue.name)} →</a></h2><p>${esc(issue.description || '')}</p><p class="entity-current-note">This place remains a factual node in the civic graph. Current reporting and historical narrative are gathered on the curated issue page to avoid duplicating the same material in two places.</p>`;
  const stack = document.querySelector('.entity-stack');
  const relationships = document.querySelector('#relationshipsSection');
  if (stack) stack.insertBefore(section, relationships || stack.firstChild);
}

async function primaryIssueForEntity(data) {
  const entityId = data.entity?.id;
  if (!entityId) return null;
  const endpoint = new URL('/.netlify/functions/civic-issues', location.origin);
  endpoint.searchParams.set('entityId', entityId);
  const response = await fetch(endpoint, { cache:'no-store' });
  if (!response.ok) return null;
  const result = await response.json();
  return (result.issues || []).find(issue => issue.isPrimaryForEntity) || null;
}

const route = routeContext();
if (route) {
  (async () => {
    try {
      const [data, feedResponse] = await Promise.all([
        fetchContext(route),
        fetch('/.netlify/functions/feed', { cache:'no-store' }).catch(() => null)
      ]);
      if (!data?.matched) return;

      if (route.kind === 'entity') {
        const primaryIssue = await primaryIssueForEntity(data).catch(() => null);
        if (primaryIssue) {
          renderPrimaryIssueHub(route, primaryIssue);
          return;
        }
      }

      const { terms, topics } = termsAndTopics(route, data);
      const feed = feedResponse?.ok ? await feedResponse.json() : { items:[] };
      const current = selectCurrent(feed.items || [], terms, topics, 8);
      const currentUrls = new Set(current.map(item => canonicalUrl(item.url)));
      const archived = await fetchHistorical(terms, topics);
      const reviewed = data.reporting || [];
      const historical = mergeHistorical(reviewed, archived, currentUrls);

      const ids = roots(route);
      const watchRoots = [document.querySelector(ids.current), document.querySelector(ids.reporting)].filter(Boolean);
      let observer = null;
      const apply = () => {
        if (observer) observer.disconnect();
        renderCurrent(route, current);
        renderHistorical(route, historical);
        if (observer) watchRoots.forEach(root => observer.observe(root, { childList:true, subtree:true }));
      };
      observer = new MutationObserver(() => apply());
      apply();
    } catch (error) {
      console.warn('Context reporting refinement unavailable', error);
    }
  })();
}
