(() => {
  const NAV_ITEMS = [
    { label: 'Latest', href: '/' },
    { label: 'Archive', href: '/archive.html', match: path => path === '/archive.html' },
    { label: 'Explore', href: '/explore.html', match: path => path === '/explore.html' || path.startsWith('/people/') || path.startsWith('/organisations/') || path.startsWith('/places/') || path.startsWith('/issues/') || path.startsWith('/topics/') },
    { label: 'Document Watch', href: '/document-watch.html', match: path => path === '/document-watch.html' },
    { label: 'Sources', href: '/#sources' },
    { label: 'Roadmap', href: '/roadmap.html', match: path => path === '/roadmap.html' },
    { label: 'Documents', href: '/documents/', match: path => path.startsWith('/documents/') },
    { label: 'About', href: '/#about' }
  ];

  const path = window.location.pathname;
  const host = window.location.hostname.toLowerCase();
  const southallDoorway = host === 'commons.southallstories.uk';
  const commonsName = southallDoorway ? 'Southall Civic Commons' : 'Ealing Civic Commons';
  const strap = southallDoorway ? 'Southall' : 'Ealing';
  const header = document.querySelector('header.site-header');
  const footer = document.querySelector('footer');

  document.documentElement.dataset.commonsScope = southallDoorway ? 'southall' : 'ealing';

  if (/Southall\s*(?:&|and)\s*Ealing Civic Commons/i.test(document.title)) {
    document.title = document.title.replace(/Southall\s*(?:&|and)\s*Ealing Civic Commons/gi, commonsName);
  }
  const description = document.querySelector('meta[name="description"]');
  if (description?.content) {
    description.content = description.content
      .replace(/Southall\s*(?:&|and)\s*Ealing Civic Commons/gi, commonsName)
      .replace(/Southall\s*(?:&|and)\s*Ealing Civic Commons/gi, commonsName);
  }

  if (header) {
    const nav = NAV_ITEMS.map(item => {
      const active = item.match ? item.match(path) : item.href === '/' && path === '/';
      return `<a href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`;
    }).join('');

    header.innerHTML = `<div class="wrap header-inner"><div><a class="brand" href="/">Civic Commons</a><div class="strap">${strap}</div></div><nav aria-label="Primary">${nav}</nav></div>`;
  }

  if (footer) {
    footer.innerHTML = `<div class="wrap footer-inner"><span>${commonsName}</span><span>Open civic infrastructure. Original sources remain canonical.</span></div>`;
  }

  function newStatusToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  document.querySelectorAll('form[name="item-contribution"], form[name="submit-source"]').forEach(form => {
    let input = form.querySelector('input[name="status-token"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'status-token';
      form.appendChild(input);
    }
    if (!input.value) input.value = newStatusToken();
    form.addEventListener('submit', () => {
      sessionStorage.setItem('civic-commons:last-submission-status-token', input.value);
    });
  });

  if (path === '/') {
    import('/commons-scope.js?v=20260903-1').catch(error => console.warn('Commons scope module unavailable', error));
  }
  if (/^\/(people|organisations|places|issues|topics)\//.test(path)) {
    import('/context-reporting.js?v=20260902-1').catch(error => console.warn('Context reporting module unavailable', error));
  }
  if (path === '/explore.html') {
    import('/explore-issue-hubs.js?v=20260902-1').catch(error => console.warn('Explore issue hubs unavailable', error));
  }
})();
