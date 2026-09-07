const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt',"'":'&#39;','"':'&quot;'}[c]));

const ELECTION_SOURCES = [
  {
    label: "Andrew Teale's Local Elections Archive Project",
    url: 'https://www.andrewteale.me.uk/leap/elections-index/#E',
    note: 'Long-run local election archive; use E for Ealing.'
  },
  {
    label: 'electionresults.uk — Ealing',
    url: 'https://electionresults.uk/councils/ealing',
    note: 'Ward-by-ward results and council composition for recent election cycles.'
  }
];

function routeFromLocation() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'people' && parts[1] ? `people/${parts[1].replace(/\.html$/, '')}` : null;
}

async function addElectionPanel() {
  const route = routeFromLocation();
  if (!route) return;

  try {
    const endpoint = new URL('/.netlify/functions/civic-entity', location.origin);
    endpoint.searchParams.set('route', route);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    const entity = data?.entity;
    if (!data?.matched || entity?.type !== 'person' || !entity?.ward || !entity?.party) return;

    const sidebar = document.querySelector('.entity-sidebar');
    if (!sidebar || document.querySelector('#electionHistoryPanel')) return;

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'electionHistoryPanel';
    panel.innerHTML = `
      <p class="eyebrow">Election record</p>
      <h3>${esc(entity.ward)} · ${esc(entity.party)}</h3>
      <p class="entity-provenance">Use these public electoral sources to trace election results and candidacy history. They are reference layers: original source pages remain canonical.</p>
      <div class="entity-provider-list">
        ${ELECTION_SOURCES.map(source => `<div class="entity-provider"><strong><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a></strong><span>${esc(source.note)}</span></div>`).join('')}
      </div>`;

    const providers = document.querySelector('#entityProviders')?.closest('.panel');
    if (providers?.nextSibling) sidebar.insertBefore(panel, providers.nextSibling);
    else sidebar.appendChild(panel);
  } catch (error) {
    console.warn('Election-history references unavailable', error);
  }
}

addElectionPanel();
