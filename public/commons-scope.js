(() => {
  const host = window.location.hostname.toLowerCase();
  const southallDoorway = host === 'commons.southallstories.uk';
  const scope = southallDoorway ? 'southall' : 'ealing';

  const config = {
    ealing: {
      title: 'Ealing Civic Commons',
      town: 'All',
      description: 'An open civic information network connecting local journalism, community organisations and democratic records across the London Borough of Ealing.',
      about: 'Ealing Civic Commons is borough-wide by default. Acton, Ealing town, Greenford, Hanwell, Northolt, Perivale and Southall remain distinct civic places that can be explored as local views of the same Commons.'
    },
    southall: {
      title: 'Southall Civic Commons',
      town: 'Southall',
      description: 'A Southall-first view of Ealing Civic Commons, connecting local journalism, community organisations and democratic records with the original sources kept visible.',
      about: 'This Southall-first doorway uses the same underlying Ealing Civic Commons data, civic graph and stable item identities. It opens with Southall selected while keeping borough-wide information available.'
    }
  }[scope];

  const hero = document.querySelector('.hero h1');
  const heroForTown = town => `What’s happening to ${town === 'All' ? 'Ealing' : town}?`;
  const updateHero = town => {
    if (hero) hero.textContent = heroForTown(town);
  };

  document.title = config.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = config.description;
  updateHero(config.town);
  const aboutParagraphs = document.querySelectorAll('#about .about-grid > div:last-child p');
  if (aboutParagraphs[1]) aboutParagraphs[1].textContent = config.about;

  const townFilter = document.querySelector('#townFilter');
  if (townFilter) {
    townFilter.addEventListener('change', event => updateHero(event.target.value));
  }

  document.querySelectorAll('#followingViewButton, [data-view-link="following"]').forEach(control => {
    control.addEventListener('click', () => updateHero('All'));
  });

  window.addEventListener('load', () => {
    if (!townFilter) return;
    if (townFilter.value !== config.town) {
      townFilter.value = config.town;
      townFilter.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      updateHero(config.town);
    }
  }, { once: true });
})();
