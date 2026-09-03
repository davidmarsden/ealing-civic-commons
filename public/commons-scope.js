(() => {
  const host = window.location.hostname.toLowerCase();
  const southallDoorway = host === 'commons.southallstories.uk';
  const scope = southallDoorway ? 'southall' : 'ealing';

  const config = {
    ealing: {
      title: 'Ealing Civic Commons',
      hero: 'What’s happening across Ealing?',
      town: 'All',
      description: 'An open civic information network connecting local journalism, community organisations and democratic records across the London Borough of Ealing.',
      about: 'Ealing Civic Commons is borough-wide by default. Acton, Ealing town, Greenford, Hanwell, Northolt, Perivale and Southall remain distinct civic places that can be explored as local views of the same Commons.'
    },
    southall: {
      title: 'Southall Civic Commons',
      hero: 'What’s happening to Southall?',
      town: 'Southall',
      description: 'A Southall-first view of Ealing Civic Commons, connecting local journalism, community organisations and democratic records with the original sources kept visible.',
      about: 'This Southall-first doorway uses the same underlying Ealing Civic Commons data, civic graph and stable item identities. It opens with Southall selected while keeping borough-wide information available.'
    }
  }[scope];

  document.title = config.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = config.description;
  const hero = document.querySelector('.hero h1');
  if (hero) hero.textContent = config.hero;
  const aboutParagraphs = document.querySelectorAll('#about .about-grid > div:last-child p');
  if (aboutParagraphs[1]) aboutParagraphs[1].textContent = config.about;

  window.addEventListener('load', () => {
    const townFilter = document.querySelector('#townFilter');
    if (!townFilter || townFilter.value === config.town) return;
    townFilter.value = config.town;
    townFilter.dispatchEvent(new Event('change', { bubbles: true }));
  }, { once: true });
})();
