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

// Stale-while-revalidate for the combined feed. Returning visitors get the
// last successful timeline immediately; the real request continues in the
// background and a normal refresh is triggered as soon as fresher data lands.
(() => {
  const CACHE_KEY = 'civic-commons:combined-feed:v1';
  const originalFetch = window.fetch.bind(window);
  let servedCachedFeed = false;
  let backgroundRefresh = null;
  let pendingLiveResponse = null;

  const isCombinedFeed = input => {
    const value = typeof input === 'string' ? input : input?.url;
    if (!value) return false;
    try { return new URL(value, location.href).pathname === '/.netlify/functions/combined-feed'; }
    catch { return false; }
  };

  const readCache = () => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached?.body || !cached?.generatedAt) return null;
      return cached;
    } catch { return null; }
  };

  const saveResponse = async response => {
    if (!response?.ok) return;
    try {
      const body = await response.clone().text();
      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed?.items)) return;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ body, generatedAt: parsed.generatedAt || new Date().toISOString() }));
    } catch {
      // Storage can be unavailable or full; the live feed still works normally.
    }
  };

  const responseFromCache = cached => new Response(cached.body, {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-civic-commons-cache': 'stale' }
  });

  const refreshWhenReady = async (input, init, cached) => {
    try {
      const live = await originalFetch(input, init);
      if (!live.ok) return;
      const body = await live.clone().text();
      let parsed;
      try { parsed = JSON.parse(body); } catch { return; }
      if (!Array.isArray(parsed?.items)) return;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ body, generatedAt: parsed.generatedAt || new Date().toISOString() })); } catch {}
      if (body === cached.body) return;
      pendingLiveResponse = new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
      document.querySelector('#refreshButton')?.click();
    } catch {
      // Keep showing the last successful timeline if an upstream refresh fails.
    }
  };

  window.fetch = (input, init) => {
    if (!isCombinedFeed(input)) return originalFetch(input, init);

    if (pendingLiveResponse) {
      const response = pendingLiveResponse;
      pendingLiveResponse = null;
      return Promise.resolve(response);
    }

    const cached = !servedCachedFeed ? readCache() : null;
    if (cached) {
      servedCachedFeed = true;
      if (!backgroundRefresh) backgroundRefresh = refreshWhenReady(input, init, cached).finally(() => { backgroundRefresh = null; });
      return Promise.resolve(responseFromCache(cached));
    }

    return originalFetch(input, init).then(response => {
      saveResponse(response);
      return response;
    });
  };
})();

// The live combined feed can take several seconds because it checks multiple
// upstream civic sources. Keep that wait visibly active only when there is no
// successful cached timeline available to render immediately.
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
    if (!timeline.querySelector('.item')) timeline.innerHTML = loadingMarkup;
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

  // Keep observers alive across every manual/background refresh. Completion
  // status is authoritative, so a legitimate final empty result is preserved.
  const statusObserver = new MutationObserver(() => {
    const text = (status.textContent || '').trim();
    if (/^(Updated|Showing prototype data|Live feeds are unavailable)/i.test(text)) finishLoading();
  });
  statusObserver.observe(status, { childList: true, characterData: true, subtree: true });

  const timelineObserver = new MutationObserver(() => {
    if (!loading) return;
    const statusText = (status.textContent || '').trim();
    if (/^(Updated|Showing prototype data|Live feeds are unavailable)/i.test(statusText)) {
      finishLoading();
      return;
    }
    const text = timeline.textContent || '';
    if (/Nothing matches these filters yet|Nothing in the current feed matches/i.test(text)) {
      timeline.innerHTML = loadingMarkup;
      count.textContent = '';
    }
  });
  timelineObserver.observe(timeline, { childList: true, subtree: true });

  refresh?.addEventListener('click', showLoading, { capture: true });
})();