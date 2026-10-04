const PLACE_RULES = [
  {
    id: 'walpole-park',
    route: 'places/walpole-park',
    label: 'Walpole Park',
    explicit: [/\bwalpole park\b/i],
    contextual: [/\btroubadour\b/i, /\bsave walpole\b/i, /\btemporary theatre\b/i, /\bpop[- ]?up theatre\b/i]
  }
];

function textFor(item = {}) {
  return `${item.title || ''} ${item.summary || ''} ${(item.topics || []).join(' ')}`.replace(/\s+/g, ' ').trim();
}

export function inferPlaceLinks(item = {}) {
  const text = textFor(item);
  if (!text) return [];
  const links = [];
  for (const rule of PLACE_RULES) {
    const explicit = rule.explicit.some(pattern => pattern.test(text));
    const contextual = rule.contextual.some(pattern => pattern.test(text));
    if (!explicit && !contextual) continue;
    links.push({ route: rule.route, label: rule.label, relationship: 'about_place', provenance: explicit ? 'explicit-place-mention' : 'inferred-place-candidate', rule_id: rule.id });
  }
  return links;
}

export function withPlaceLinks(item = {}) {
  const existing = Array.isArray(item.placeLinks) ? item.placeLinks : [];
  const inferred = inferPlaceLinks(item);
  const byRoute = new Map(existing.filter(link => link?.route).map(link => [link.route, link]));
  for (const link of inferred) if (!byRoute.has(link.route)) byRoute.set(link.route, link);
  return { ...item, placeLinks: [...byRoute.values()] };
}

export function itemLinksToPlace(item = {}, route) {
  if (!route) return false;
  return withPlaceLinks(item).placeLinks.some(link => link.route === route);
}
