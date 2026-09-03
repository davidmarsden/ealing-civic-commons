(() => {
  const BOROUGH_TOWNS = ['Acton', 'Ealing', 'Greenford', 'Hanwell', 'Northolt', 'Perivale', 'Southall'];
  const followingView = window.location.hash === '#following';
  const params = new URLSearchParams(window.location.search);
  const requestedTown = params.get('town');
  const initialTown = BOROUGH_TOWNS.includes(requestedTown) ? requestedTown : 'All';

  const config = {
    title: 'Ealing Civic Commons',
    description: 'An open civic information network connecting local journalism, community organisations and democratic records across the London Borough of Ealing.',
    about: 'Ealing Civic Commons is borough-wide by default. Acton, Ealing town, Greenford, Hanwell, Northolt, Perivale and Southall remain distinct civic places that can be explored as local views of the same Commons.'
  };

  const hero = document.querySelector('.hero h1');
  const placeName = town => town === 'All' ? 'Ealing' : town === 'Ealing' ? 'Ealing town' : town;
  const heroForTown = town => `What’s happening to ${placeName(town)}?`;
  const updateHero = town => {
    if (hero) hero.textContent = heroForTown(town);
  };
  const updateBrand = town => {
    if (!window.CivicCommonsBrand) return;
    if (town === 'All') window.CivicCommonsBrand.reset();
    else window.CivicCommonsBrand.setTown(town);
  };

  function updateTownUrl(town) {
    if (followingView) return;
    const next = new URL(window.location.href);
    if (town === 'All') next.searchParams.delete('town');
    else next.searchParams.set('town', town);
    window.history.replaceState({}, '', `${next.pathname}${next.search}${next.hash}`);
  }

  document.title = config.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = config.description;
  updateHero(followingView ? 'All' : initialTown);
  updateBrand(followingView ? 'All' : initialTown);
  const aboutParagraphs = document.querySelectorAll('#about .about-grid > div:last-child p');
  if (aboutParagraphs[1]) aboutParagraphs[1].textContent = config.about;

  const townFilter = document.querySelector('#townFilter');
  if (townFilter) {
    townFilter.addEventListener('change', event => {
      updateHero(event.target.value);
      updateBrand(event.target.value);
      updateTownUrl(event.target.value);
    });
  }

  document.querySelectorAll('#followingViewButton, [data-view-link="following"]').forEach(control => {
    control.addEventListener('click', () => {
      updateHero('All');
      updateBrand('All');
    });
  });

  function applyInitialTown() {
    if (!townFilter || window.location.hash === '#following') {
      updateHero('All');
      updateBrand('All');
      return;
    }
    if (townFilter.value !== initialTown) {
      townFilter.value = initialTown;
      townFilter.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      updateHero(initialTown);
      updateBrand(initialTown);
    }
  }

  if (document.readyState === 'complete') {
    applyInitialTown();
  } else {
    window.addEventListener('load', applyInitialTown, { once: true });
  }
})();
