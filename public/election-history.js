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

function isCouncillorPage() {
  const bodyRoute = document.body?.dataset?.entityId || '';
  if (bodyRoute.startsWith('civic:person:')) return true;
  const path = location.pathname.split('/').filter(Boolean);
  return path[0] === 'people' && Boolean(path[1]);
}

function renderElectionPanel() {
  const hero = document.querySelector('#entityHero');
  if (!hero || hero.hidden || document.querySelector('#electionHistoryPanel') || !isCouncillorPage()) return false;

  const councillorLink = [...hero.querySelectorAll('a')].find(link => {
    try {
      const url = new URL(link.href, location.origin);
      return url.hostname === 'ealing.moderngov.co.uk' && url.pathname.endsWith('/mgMemberIndex.aspx');
    } catch {
      return false;
    }
  });

  const roleText = hero.textContent || '';
  const appearsToBeCouncillor = /\bcouncillor\b/i.test(roleText) || Boolean(councillorLink);
  if (!appearsToBeCouncillor) return false;

  const sidebar = document.querySelector('.entity-sidebar');
  if (!sidebar) return false;

  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.id = 'electionHistoryPanel';
  panel.innerHTML = `
    <p class="eyebrow">Election record</p>
    <h3>Ealing electoral history</h3>
    <p class="entity-provenance">This profile is the canonical current-person record. Search results can attach the councillor's dated official election result to the same profile; these wider electoral sources provide the longer historical context.</p>
    <div class="entity-provider-list">
      ${ELECTION_SOURCES.map(source => `<div class="entity-provider"><strong><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a></strong><span>${esc(source.note)}</span></div>`).join('')}
    </div>`;

  const providers = document.querySelector('#entityProviders')?.closest('.panel');
  if (providers?.nextSibling) sidebar.insertBefore(panel, providers.nextSibling);
  else sidebar.appendChild(panel);
  return true;
}

if (!renderElectionPanel()) {
  const hero = document.querySelector('#entityHero');
  if (hero) {
    const observer = new MutationObserver(() => {
      if (renderElectionPanel()) observer.disconnect();
    });
    observer.observe(hero, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  }
}
