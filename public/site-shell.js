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
  const commonsName = 'Ealing Civic Commons';
  const strap = 'Ealing';
  const header = document.querySelector('header.site-header');
  const footer = document.querySelector('footer');

  document.documentElement.dataset.commonsScope = 'ealing';

  if (!document.querySelector('link[data-commons-brand-styles]')) {
    const brandStyles = document.createElement('link');
    brandStyles.rel = 'stylesheet';
    brandStyles.href = '/brand/brand.css?v=20260903-2';
    brandStyles.dataset.commonsBrandStyles = 'true';
    document.head.appendChild(brandStyles);
  }

  const normaliseCommonsIdentity = value => value
    ? String(value).replace(/Southall\s*(?:&|and)\s*Ealing Civic Commons/gi, commonsName)
      .replace(/Southall Civic Commons/gi, commonsName)
    : value;

  document.title = normaliseCommonsIdentity(document.title);
  const description = document.querySelector('meta[name="description"]');
  if (description?.content) description.content = normaliseCommonsIdentity(description.content);

  if (!document.querySelector('link[rel="icon"][data-commons-brand]')) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/webp';
    icon.href = '/brand/ealing-oak-approved.webp';
    icon.dataset.commonsBrand = 'ealing-oak';
    document.head.appendChild(icon);
  }

  if (header) {
    const nav = NAV_ITEMS.map(item => {
      const active = item.match ? item.match(path) : item.href === '/' && path === '/';
      return `<a href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`;
    }).join('');

    header.innerHTML = `<div class="wrap header-inner"><a class="brand-lockup" href="/" aria-label="${commonsName}"><img class="brand-mark" src="/brand/ealing-oak-approved.webp" alt="" aria-hidden="true"><span class="brand-divider" aria-hidden="true"></span><span class="brand-copy"><strong class="brand">CIVIC COMMONS</strong><span class="strap"><span></span>${strap}<span></span></span></span></a><nav aria-label="Primary">${nav}</nav></div>`;
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
    import('/commons-scope.js?v=20260903-2').catch(error => console.warn('Commons scope module unavailable', error));
  }
  if (/^\/(people|organisations|places|issues|topics)\//.test(path)) {
    import('/context-reporting.js?v=20260902-1').catch(error => console.warn('Context reporting unavailable', error));
  }
  if (path === '/explore.html') {
    import('/explore-issue-hubs.js?v=20260902-1').catch(error => console.warn('Explore issue hubs unavailable', error));
  }
})();
