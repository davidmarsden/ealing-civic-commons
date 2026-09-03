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

  const NORTHOLT_MARK = 'data:image/jpeg;base64,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',
    Acton: { slug: 'acton', label: 'Acton', staticMark: true },
    Ealing: { slug: 'ealing-town', label: 'Ealing town' },
    Greenford: { slug: 'greenford', label: 'Greenford', staticMark: true },
    Hanwell: { slug: 'hanwell', label: 'Hanwell' },
    Northolt: { slug: 'northolt', label: 'Northolt', staticMark: true, asset: NORTHOLT_MARK },
    Perivale: { slug: 'perivale', label: 'Perivale', staticMark: true },
    Southall: { slug: 'southall', label: 'Southall' }
  };
  const TOWN_BY_SLUG = Object.fromEntries(Object.entries(TOWN_BRANDS).map(([town, brand]) => [brand.slug, town]));

  const path = window.location.pathname;
  const commonsName = 'Ealing Civic Commons';
  const header = document.querySelector('header.site-header');
  const footer = document.querySelector('footer');

  document.documentElement.dataset.commonsScope = 'ealing';

  if (!document.querySelector('link[data-commons-brand-styles]')) {
    const brandStyles = document.createElement('link');
    brandStyles.rel = 'stylesheet';
    brandStyles.href = '/brand/brand.css?v=20260903-3';
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

  function brandForTown(town) {
    return TOWN_BRANDS[town] || null;
  }

  function assetForBrand(brand) {
    if (!brand) return '/brand/ealing-oak-approved.webp';
    if (brand.asset) return brand.asset;
    return `/brand/towns/${brand.slug}.${brand.staticMark ? 'svg' : 'webp'}`;
  }

  function townFromPlacePath() {
    const match = path.match(/^\/places\/([^/]+)/i);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]).toLowerCase();
    return TOWN_BY_SLUG[slug] || Object.keys(TOWN_BRANDS).find(town => town.toLowerCase() === slug) || null;
  }

  function requestedTown() {
    if (path === '/') {
      const town = new URLSearchParams(window.location.search).get('town');
      return brandForTown(town) ? town : null;
    }
    return townFromPlacePath();
  }

  function applyTownBrand(town = null) {
    const brand = brandForTown(town);
    const mark = document.querySelector('.brand-mark');
    const strapLabel = document.querySelector('.brand-copy .strap-label');
    const icon = document.querySelector('link[rel="icon"][data-commons-brand]');
    if (!mark || !strapLabel) return;

    if (brand) {
      const asset = assetForBrand(brand);
      mark.src = asset;
      mark.classList.add('brand-mark-town');
      strapLabel.textContent = brand.label;
      if (icon) { icon.type = brand.asset ? 'image/jpeg' : (brand.staticMark ? 'image/svg+xml' : 'image/webp'); icon.href = asset; }
      document.documentElement.dataset.commonsTown = brand.slug;
    } else {
      mark.src = '/brand/ealing-oak-approved.webp';
      mark.classList.remove('brand-mark-town');
      strapLabel.textContent = 'Ealing';
      if (icon) { icon.type = 'image/webp'; icon.href = '/brand/ealing-oak-approved.webp'; }
      delete document.documentElement.dataset.commonsTown;
    }
  }

  window.CivicCommonsBrand = {
    towns: TOWN_BRANDS,
    setTown: applyTownBrand,
    reset: () => applyTownBrand(null),
    townFromPlacePath,
    brandForTown,
    assetForBrand
  };

  if (header) {
    const nav = NAV_ITEMS.map(item => {
      const active = item.match ? item.match(path) : item.href === '/' && path === '/';
      return `<a href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`;
    }).join('');

    header.innerHTML = `<div class="wrap header-inner"><a class="brand-lockup" href="/" aria-label="${commonsName}"><img class="brand-mark" src="/brand/ealing-oak-approved.webp" alt="" aria-hidden="true"><span class="brand-divider" aria-hidden="true"></span><span class="brand-copy"><strong class="brand">CIVIC COMMONS</strong><span class="strap"><span></span><span class="strap-label">Ealing</span><span></span></span></span></a><nav aria-label="Primary">${nav}</nav></div>`;
    applyTownBrand(requestedTown());
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
    import('/commons-scope.js?v=20260903-3').catch(error => console.warn('Commons scope module unavailable', error));
  }
  if (/^\/(people|organisations|places|issues|topics)\//.test(path)) {
    import('/context-reporting.js?v=20260902-1').catch(error => console.warn('Context reporting unavailable', error));
  }
  if (path === '/explore.html') {
    import('/explore-issue-hubs.js?v=20260902-1').catch(error => console.warn('Explore issue hubs unavailable', error));
  }
})();
