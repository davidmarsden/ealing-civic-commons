(() => {
  const timeline = document.querySelector('#timeline');
  const count = document.querySelector('#itemCount');
  const status = document.querySelector('#status');
  const refresh = document.querySelector('#refreshButton');
  if (!timeline || !count || !status) return;

  const loadingMarkup = `
    <div class="timeline-loading" role="status" aria-live="polite" aria-label="Gathering the latest civic information">
      <div class="timeline-loading-copy">
        <strong>Gathering the latest civic information…</strong>
        <span>Checking local reporting, community sources and public records. This can take a few seconds.</span>
      </div>
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
    if (refresh) {
      refresh.disabled = true;
      refresh.setAttribute('aria-disabled', 'true');
      refresh.textContent = 'Refreshing…';
    }
  }

  function finishLoading() {
    if (!loading) return;
    loading = false;
    timeline.removeAttribute('aria-busy');
    if (refresh) {
      refresh.disabled = false;
      refresh.removeAttribute('aria-disabled');
      refresh.textContent = 'Refresh';
    }
  }

  showLoading();

  // app.js owns the final rendered feed. While it is still fetching, do not
  // allow an intermediate render to claim that the feed contains zero items.
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

  // Refresh starts another live fetch. Restore the honest loading state until
  // app.js reports success or failure rather than briefly showing stale counts.
  refresh?.addEventListener('click', () => {
    showLoading();
  }, { capture: true });
})();
