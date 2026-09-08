const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt', "'":'&#39;', '"':'&quot;' }[char]));
const fmtDate = iso => {
  if (!iso) return 'Date unavailable';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? String(iso) : new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'long', year:'numeric' }).format(date);
};

function issueRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'issues' && parts[1] ? `issues/${parts[1].replace(/\.html$/i, '')}` : null;
}

function addPlanningJump() {
  const actions = document.querySelector('#issueHero .entity-actions');
  if (!actions || actions.querySelector('a[href="#planningSection"]')) return;
  const link = document.createElement('a');
  link.href = '#planningSection';
  link.textContent = 'Planning register ↓';
  const actors = actions.querySelector('a[href="#actorsSection"]');
  actions.insertBefore(link, actors || null);
}

function renderPlanning(records, primaryRoute) {
  const section = document.querySelector('#planningSection');
  const root = document.querySelector('#issuePlanning');
  if (!section || !root || !records.length) return;

  root.innerHTML = `<ul class="entity-list">${records.map(record => {
    const link = (record.place_links || []).find(item => item.route === primaryRoute);
    const provenance = link?.provenance === 'reviewed-rule'
      ? `Reviewed site link${link.note ? ` · ${link.note}` : ''}`
      : 'Linked from conservative town classification';
    return `<li><span class="relationship-type">${esc(record.category || 'Planning application')}</span><h3><a href="${esc(record.commons_path)}">${esc(record.reference)} · ${esc(record.address)}</a></h3><p>${esc(record.proposal)}</p><span class="entity-meta">Validated ${esc(fmtDate(record.validated_date))} · ${esc(record.status || 'Status unavailable')}</span><span class="entity-meta">${esc(provenance)} · <a href="${esc(record.authoritative_url)}" target="_blank" rel="noopener noreferrer">Ealing Council planning record ↗</a></span></li>`;
  }).join('')}</ul>`;

  section.hidden = false;
  addPlanningJump();
  if (location.hash === '#planningSection') requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
}

async function loadIssuePlanning() {
  const route = issueRoute();
  if (!route) return;

  try {
    const issueEndpoint = new URL('/.netlify/functions/civic-issue', location.origin);
    issueEndpoint.searchParams.set('route', route);
    const [issueResponse, planningResponse] = await Promise.all([
      fetch(issueEndpoint, { cache:'no-store' }),
      fetch('/data/planning-latest.json', { cache:'no-store' })
    ]);
    if (!issueResponse.ok || !planningResponse.ok) return;
    const issueData = await issueResponse.json();
    const snapshot = await planningResponse.json();
    if (!issueData.matched || !issueData.issue?.primaryEntityId) return;

    const primary = (issueData.entities || []).find(entity => entity.id === issueData.issue.primaryEntityId);
    const primaryRoute = primary?.commonsRoute;
    if (!primaryRoute) return;

    const records = (snapshot.records || [])
      .filter(record => !record.out_of_borough && (record.place_links || []).some(link => link.route === primaryRoute))
      .sort((a, b) => (Date.parse(b.validated_date || '') || 0) - (Date.parse(a.validated_date || '') || 0));
    renderPlanning(records, primaryRoute);
  } catch (error) {
    console.warn('Issue planning unavailable', error);
  }
}

loadIssuePlanning();
