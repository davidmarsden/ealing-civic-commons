window.CIVIC_COMMONS_DEMO = {
  generatedAt: '2026-08-26T12:00:00Z',
  health: [
    {id:'southall-residents-alliance',name:'Southall Residents Alliance',ok:true,itemCount:3},
    {id:'southall-transition',name:'Southall Transition',ok:true,itemCount:1},
    {id:'modern-gov',name:'Ealing Council — ModernGov',ok:true,itemCount:4},
    {id:'ealing-matters',name:'Ealing Matters',ok:true,itemCount:2}
  ],
  items: [
    {
      id:'demo:sra:wickets', sourceId:'southall-residents-alliance', source:'Southall Residents Alliance', sourceClass:'Organisation / campaign',
      title:'Bowlers Beware: The Trip Hazards Haunting Southall Recreation Ground',
      url:'https://southallresidentsalliance.co.uk/bowlers-beware-the-trip-hazards-haunting-southall-recreation-ground/',
      summary:'A local campaign argues that damaged cricket wickets at Southall Recreation Ground remain a safety hazard and calls on Ealing Council to repair or replace them.',
      publishedAt:'2026-08-23T09:00:00Z', towns:['Southall'], topics:['Community','Council & democracy']
    },
    {
      id:'demo:sra:protest', sourceId:'southall-residents-alliance', source:'Southall Residents Alliance', sourceClass:'Organisation / campaign',
      title:'Powerful Southall Residents Unite in Protest to Highlight the failings of Ealing Council',
      url:'https://southallresidentsalliance.co.uk/powerful-southall-residents-unite-in-protest-to-highlight-the-failings-of-ealing-council/',
      summary:'Southall Residents Alliance reports on a community protest concerning the relocation of Ealing RISE and wider concerns about safety and public services.',
      publishedAt:'2026-08-18T09:00:00Z', towns:['Southall'], topics:['Council & democracy','Community','Policing & safety']
    },
    {
      id:'demo:sra:press-release', sourceId:'southall-residents-alliance', source:'Southall Residents Alliance', sourceClass:'Organisation / campaign',
      title:'Southall Town Hall Protest Press Release',
      url:'https://southallresidentsalliance.co.uk/southall-town-hall-protest-press-release/',
      summary:'A press release announcing an August protest outside the former Southall Town Hall and setting out residents’ demands for public meetings and a safety strategy.',
      publishedAt:'2026-08-10T09:00:00Z', towns:['Southall'], topics:['Council & democracy','Community','Policing & safety']
    },
    {
      id:'demo:transition:bixley', sourceId:'southall-transition', source:'Southall Transition', sourceClass:'Organisation / campaign',
      title:'Bixley Community Plot',
      url:'https://southalltransition.org/',
      summary:'Southall Transition describes the restoration of a community plot and food forest and invites local people to join the project and learn to grow food.',
      publishedAt:'2026-08-04T09:00:00Z', towns:['Southall'], topics:['Environment','Community']
    },
    {
      id:'demo:official:placeholder', sourceId:'modern-gov', source:'Ealing Council — ModernGov', sourceClass:'Official record',
      title:'New council agendas, minutes and decisions',
      url:'https://ealing.moderngov.co.uk/mgWhatsNew.aspx',
      summary:'The live prototype connects Ealing Council’s official ModernGov “What’s new” feed so newly published democratic records can appear alongside independent local sources.',
      publishedAt:'2026-08-01T08:00:00Z', towns:['Ealing','Acton','Greenford','Hanwell','Northolt','Perivale','Southall'], topics:['Council & democracy']
    }
  ]
};

// The live combined feed can take several seconds because it checks multiple
// upstream civic sources. Keep that wait visibly active and never present an
// intermediate zero-item/empty-feed state as if loading had completed.
(() => {
  const timeline = document.querySelector('#timeline');
  const count = document.querySelector('#itemCount');
  const status = document.querySelector('#status');
  const refresh = document.querySelector('#refreshButton');
  if (!timeline || !count || !status) return;

  const style = document.createElement('style');
  style.textContent = `
    .timeline-loading{padding:1.35rem 0 0}.timeline-loading-copy{display:grid;gap:.35rem;margin-bottom:1.25rem;color:var(--ink,#172019)}
    .timeline-loading-copy strong{font-size:1.05rem}.timeline-loading-copy span{color:var(--muted,#687067);max-width:48rem}
    .timeline-skeleton{display:grid;gap:1rem}.skeleton-card{border-top:1px solid rgba(23,32,25,.16);padding:1.15rem 0;display:grid;gap:.65rem;overflow:hidden}
    .skeleton-card span,.skeleton-card b,.skeleton-card i{display:block;border-radius:999px;background:linear-gradient(90deg,rgba(23,32,25,.07) 25%,rgba(23,32,25,.13) 50%,rgba(23,32,25,.07) 75%);background-size:200% 100%;animation:civic-loading 1.4s ease-in-out infinite}
    .skeleton-card span{width:22%;height:.75rem}.skeleton-card b{width:72%;height:1.35rem}.skeleton-card i{width:94%;height:.8rem}.skeleton-card i:last-child{width:61%}
    @keyframes civic-loading{0%{background-position:200% 0}100%{background-position:-200% 0}}
    @media (prefers-reduced-motion:reduce){.skeleton-card span,.skeleton-card b,.skeleton-card i{animation:none}}
  `;
  document.head.appendChild(style);

  const loadingMarkup = `
    <div class="timeline-loading" role="status" aria-live="polite" aria-label="Gathering the latest civic information">
      <div class="timeline-loading-copy"><strong>Gathering the latest civic information…</strong><span>Checking local reporting, community sources and public records. This can take a few seconds.</span></div>
      <div class="timeline-skeleton" aria-hidden="true">
        <div class="skeleton-card"><span></span><b></b><i></i><i></i></div>
        <div class="skeleton-card"><span></span><b></b><i></i><i></i></div>
        <div class="skeleton-card"><span></span><b></b><i></i><i></i></div>
      </div>
    </div>`;

  let loading = true;
  function showLoading() {
    loading = true;
    count.textContent = '';
    timeline.innerHTML = loadingMarkup;
    timeline.setAttribute('aria-busy', 'true');
    if (refresh) { refresh.disabled = true; refresh.textContent = 'Refreshing…'; }
  }
  function finishLoading() {
    if (!loading) return;
    loading = false;
    timeline.removeAttribute('aria-busy');
    if (refresh) { refresh.disabled = false; refresh.textContent = 'Refresh'; }
  }

  showLoading();

  const timelineObserver = new MutationObserver(() => {
    if (!loading) return;
    const text = timeline.textContent || '';
    if (/Nothing matches these filters yet|Nothing in the current feed matches/i.test(text)) {
      timeline.innerHTML = loadingMarkup;
      count.textContent = '';
    }
  });
  timelineObserver.observe(timeline, { childList: true, subtree: true });

  const statusObserver = new MutationObserver(() => {
    const text = (status.textContent || '').trim();
    if (/^(Updated|Showing prototype data|Live feeds are unavailable)/i.test(text)) {
      finishLoading();
      statusObserver.disconnect();
      timelineObserver.disconnect();
    }
  });
  statusObserver.observe(status, { childList: true, characterData: true, subtree: true });

  refresh?.addEventListener('click', showLoading, { capture: true });
})();
