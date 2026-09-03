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

  const TOWN_BRANDS = {
    Acton: { slug: 'acton', label: 'Acton', staticMark: true },
    Ealing: { slug: 'ealing-town', label: 'Ealing town' },
    Greenford: { slug: 'greenford', label: 'Greenford', staticMark: true },
    Hanwell: { slug: 'hanwell', label: 'Hanwell' },
    Northolt: { slug: 'northolt', label: 'Northolt' },
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
      if (icon) { icon.type = brand.staticMark ? 'image/svg+xml' : 'image/webp'; icon.href = asset; }
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
