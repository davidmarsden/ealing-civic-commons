const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));

const ELECTION_SOURCES = [
  {
    label: "Andrew Teale's Local Elections Archive Project",
    url: 'https://www.andrewteale.me.uk/leap/elections-index/#E',
    note: 'Pre-2021 historical source, carried into the structured layer through electionresults.uk.'
  },
  {
    label: 'electionresults.uk — Ealing',
    url: 'https://electionresults.uk/councils/ealing',
    note: 'Structured ward/candidate data for 2018 and 2022, with documented upstream provenance.'
  }
];

function routeFromLocation() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'people' && parts[1] ? `people/${parts[1].replace(/\.html$/, '')}` : null;
}

function isCouncillorPage() {
  const path = location.pathname.split('/').filter(Boolean);
  return path[0] === 'people' && Boolean(path[1]);
}

function fmtDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

function resultLabel(record) {
  return record?.result?.elected ? 'Elected' : 'Not elected';
}

function sourceLabel(record) {
  return record?.provenance?.provider || 'Election source';
}

function historyMarkup(records = []) {
  if (!records.length) return '<p class="entity-provenance">No structured candidacy records are currently linked to this profile.</p>';
  return `<div class="entity-provider-list">${records.map(record => {
    const ballot = record.ballot?.description || 'Ballot description unavailable';
    const ballotNote = record.ballot?.fidelity === 'normalized-by-source' ? ' · party label normalised by source' : '';
    const wardCode = record.ward?.ecCode ? ` · ${esc(record.ward.ecCode)}` : '';
    const boundary = record.ward?.boundaryEra?.label || 'Boundary era unavailable';
    const source = record.provenance?.providerUrl
      ? `<a href="${esc(record.provenance.providerUrl)}" target="_blank" rel="noopener noreferrer">${esc(sourceLabel(record))} ↗</a>`
      : esc(sourceLabel(record));
    const identityNote = record.identity?.reviewState === 'algorithmic'
      ? `<span>Identity link: ${esc(record.identity.confidence || 'unrated')} confidence · ${esc(record.identity.method || 'algorithmic match')}</span>`
      : '';
    return `<div class="entity-provider">
      <strong>${esc(fmtDate(record.electionDate))} · ${esc(record.ward?.name || 'Ward unavailable')} · ${esc(resultLabel(record))}</strong>
      <span>${esc(ballot)} · ${Number(record.votes || 0).toLocaleString('en-GB')} votes${esc(ballotNote)}</span>
      <span>${esc(boundary)}${wardCode}</span>
      <span>Source: ${source}</span>
      ${identityNote}
    </div>`;
  }).join('')}</div>`;
}

async function fetchHistory() {
  const route = routeFromLocation();
  if (!route) return [];
  const endpoint = new URL('/.netlify/functions/ealing-candidacy-history', location.origin);
  endpoint.searchParams.set('route', route);
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Candidacy history HTTP ${response.status}`);
  const data = await response.json();
  return data.records || [];
}

async function renderElectionPanel() {
  const hero = document.querySelector('#entityHero');
  if (!hero || hero.hidden || document.querySelector('#electionHistoryPanel') || !isCouncillorPage()) return false;

  const roleText = hero.textContent || '';
  const councillorLink = [...hero.querySelectorAll('a')].find(link => {
    try {
      const url = new URL(link.href, location.origin);
      return url.hostname === 'ealing.moderngov.co.uk' && url.pathname.endsWith('/mgMemberIndex.aspx');
    } catch {
      return false;
    }
  });
  if (!/\bcouncillor\b/i.test(roleText) && !councillorLink) return false;

  const sidebar = document.querySelector('.entity-sidebar');
  if (!sidebar) return false;

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'electionHistoryPanel';
  panel.innerHTML = `
    <p class="eyebrow">Election record</p>
    <h3>Structured candidacy history</h3>
    <p class="entity-provenance">Each candidacy is stored as a dated civic event with its own ward/boundary era, ballot description, vote/result data and provenance. Identity matching is recorded separately rather than folded into biography.</p>
    <div id="structuredCandidacyHistory"><span class="entity-empty">Loading candidacy history…</span></div>
    <div class="entity-provider-list" style="margin-top:1rem">
      ${ELECTION_SOURCES.map(source => `<div class="entity-provider"><strong><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a></strong><span>${esc(source.note)}</span></div>`).join('')}
    </div>`;

  const providers = document.querySelector('#entityProviders')?.closest('.panel');
  if (providers?.nextSibling) sidebar.insertBefore(panel, providers.nextSibling);
  else sidebar.appendChild(panel);

  try {
    const records = await fetchHistory();
    const root = document.querySelector('#structuredCandidacyHistory');
    if (root) root.innerHTML = historyMarkup(records);
  } catch (error) {
    const root = document.querySelector('#structuredCandidacyHistory');
    if (root) root.innerHTML = '<p class="entity-provenance">Structured candidacy history is temporarily unavailable. External electoral sources remain linked below.</p>';
    console.warn('Candidacy history unavailable', error);
  }
  return true;
}

if (!(await renderElectionPanel())) {
  const hero = document.querySelector('#entityHero');
  if (hero) {
    const observer = new MutationObserver(async () => {
      if (await renderElectionPanel()) observer.disconnect();
    });
    observer.observe(hero, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }
}
