(() => {
  const NAV_ITEMS = [
    { label: 'Latest', href: '/' },
    { label: 'Explore', href: '/explore.html', match: path => path === '/explore.html' || path.startsWith('/people/') || path.startsWith('/organisations/') || path.startsWith('/places/') || path.startsWith('/issues/') || path.startsWith('/topics/') },
    { label: 'Document Watch', href: '/document-watch.html', match: path => path === '/document-watch.html' },
    { label: 'Sources', href: '/#sources' },
    { label: 'Roadmap', href: '/roadmap.html', match: path => path === '/roadmap.html' },
    { label: 'Documents', href: '/documents/', match: path => path.startsWith('/documents/') },
    { label: 'About', href: '/#about' }
  ];

  const path = window.location.pathname;
  const header = document.querySelector('header.site-header');
  const footer = document.querySelector('footer');

  if (header) {
    const nav = NAV_ITEMS.map(item => {
      const active = item.match ? item.match(path) : item.href === '/' && path === '/';
      return `<a href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`;
    }).join('');

    header.innerHTML = `<div class="wrap header-inner"><div><a class="brand" href="/">Civic Commons</a><div class="strap">Southall & Ealing</div></div><nav aria-label="Primary">${nav}</nav></div>`;
  }

  if (footer) {
    footer.innerHTML = '<div class="wrap footer-inner"><span>Southall & Ealing Civic Commons</span><span>Open civic infrastructure. Original sources remain canonical.</span></div>';
  }
})();
