(() => {
  const brandApi = window.CivicCommonsBrand;
  if (!brandApi) return;
  const town = brandApi.townFromPlacePath();
  const brand = brandApi.brandForTown(town);
  if (!town || !brand) return;

  brandApi.setTown(town);

  const hero = document.querySelector('#entityHero');
  if (!hero) return;

  function applyPlaceMark() {
    if (!hero.querySelector('h1') || hero.querySelector('.entity-place-mark')) return false;
    const mark = document.createElement('img');
    mark.className = 'entity-place-mark';
    mark.src = `/brand/towns/${brand.slug}.webp`;
    mark.alt = '';
    mark.setAttribute('aria-hidden', 'true');
    mark.width = 132;
    mark.height = 132;
    hero.classList.add('entity-hero-branded');
    hero.prepend(mark);
    return true;
  }

  if (!applyPlaceMark()) {
    const observer = new MutationObserver(() => {
      if (applyPlaceMark()) observer.disconnect();
    });
    observer.observe(hero, { childList: true, subtree: true });
  }
})();
