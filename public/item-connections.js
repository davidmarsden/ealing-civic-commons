const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const relationshipLabel = value => String(value || 'related to').replaceAll('_', ' ');

function normalizedText(value) {
  return String(value || '').normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phraseMatch(text, phrase) {
  const candidate = normalizedText(phrase).trim();
  if (candidate.length < 4 || !/[A-Za-z]/.test(candidate)) return null;
  const pattern = new RegExp(`(^|[^A-Za-z0-9])(${escapeRegExp(candidate)})(?=[^A-Za-z0-9]|$)`, 'i');
  const match = pattern.exec(text);
  if (!match) return null;
  const start = match.index + match[1].length;
  return { start, end: start + match[2].length, phrase: match[2] };
}

function isEmbeddedPlacePrefix(text, entity, match) {
  if (entity.type !== 'place') return false;
  if (match.phrase.trim().split(/\s+/).length > 2) return false;
  const after = text.slice(match.end);
  const nextWord = after.match(/^\s+([A-Z][A-Za-z'-]{2,})/);
  return Boolean(nextWord);
}

function bestEntityMatch(text, entity) {
  const phrases = [entity.name, ...(entity.aliases || [])]
    .map(normalizedText)
    .map(value => value.trim())
    .filter(value => value.length >= 4)
    .sort((a, b) => b.length - a.length);

  for (const phrase of phrases) {
    const match = phraseMatch(text, phrase);
    if (!match) continue;
    if (isEmbeddedPlacePrefix(text, entity, match)) continue;
    return match;
  }
  return null;
}

function directEntityMatches(text, entities) {
  const typePriority = { person: 0, organisation: 1, place: 2 };
  return (entities || [])
    .map(entity => ({ entity, match: bestEntityMatch(text, entity) }))
    .filter(item => item.match)
    .sort((a, b) => (typePriority[a.entity.type] ?? 9) - (typePriority[b.entity.type] ?? 9) || b.match.phrase.length - a.match.phrase.length || a.entity.name.localeCompare(b.entity.name));
}

function entityChip(entity, suffix = '', displayName = null) {
  const route = entity.route || entity.commonsRoute;
  const href = route ? `/${route}` : null;
  const shown = displayName || entity.name;
  const label = `${esc(shown)}${suffix ? ` <small>${esc(suffix)}</small>` : ''}`;
  return href ? `<a class="entity-link-chip" href="${esc(href)}">${label}<span aria-hidden="true">→</span></a>` : `<span class="entity-link-chip">${label}</span>`;
}

async function reviewedConnectionsForEntity(entity) {
  if (!entity.route) return [];
  const endpoints = [
    `/.netlify/functions/civic-entity?route=${encodeURIComponent(entity.route)}`,
    `/.netlify/functions/civic-assertions?route=${encodeURIComponent(entity.route)}`
  ];
  const results = await Promise.allSettled(endpoints.map(url => fetch(url, { cache: 'no-store' }).then(response => response.ok ? response.json() : null)));
  return results.flatMap(result => result.status === 'fulfilled' && result.value ? (result.value.relationships || result.value.assertions || []) : []);
}

async function renderConnections() {
  const section = document.querySelector('#itemEntityLinks');
  const content = document.querySelector('#itemEntityLinksContent');
  const title = document.querySelector('#itemView h1');
  const summary = document.querySelector('#itemView .item-page-summary');
  if (!section || !content || !title) return false;

  try {
    const response = await fetch('/.netlify/functions/civic-entities', { cache: 'no-store' });
    if (!response.ok) return true;
    const data = await response.json();
    const text = normalizedText(`${title.textContent || ''}\n${summary?.textContent || ''}`);
    const directMatches = directEntityMatches(text, data.entities).slice(0, 8);
    if (!directMatches.length) {
      section.hidden = true;
      return true;
    }

    const direct = directMatches.map(item => item.entity);
    const directIds = new Set(direct.map(entity => entity.id));
    const relationshipSets = await Promise.all(direct.slice(0, 6).map(reviewedConnectionsForEntity));
    const related = new Map();
    relationshipSets.flat().forEach(rel => {
      const other = rel?.other;
      if (!other?.id || directIds.has(other.id) || !other.commonsRoute) return;
      if (!related.has(other.id)) related.set(other.id, { id: other.id, name: other.name, commonsRoute: other.commonsRoute, relationship: relationshipLabel(rel.type) });
    });

    const relatedItems = [...related.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
    const directChips = directMatches.map(({ entity, match }) => {
      const sourceName = match.phrase;
      const suffix = normalizedText(sourceName).toLowerCase() === normalizedText(entity.name).toLowerCase() ? entity.type : `${entity.type} · ${entity.name}`;
      return entityChip(entity, suffix, sourceName);
    }).join('');
    content.innerHTML = `<div class="entity-link-row"><strong>Mentioned in this source</strong><div class="entity-link-chips">${directChips}</div></div>${relatedItems.length ? `<div class="entity-link-row"><strong>Connected through reviewed evidence</strong><div class="entity-link-chips">${relatedItems.map(entity => entityChip(entity, entity.relationship)).join('')}</div></div>` : ''}<p class="entity-link-note">Direct links preserve the wording used by the source while resolving reviewed aliases to a canonical civic entity. Related links are one step away in the reviewed civic graph; they are not claims made by the original publisher.</p>`;
    section.hidden = false;
    return true;
  } catch (error) {
    console.warn('Refined civic entity links unavailable', error);
    return true;
  }
}

async function start() {
  if (await renderConnections()) return;
  const observer = new MutationObserver(async () => {
    if (await renderConnections()) observer.disconnect();
  });
  observer.observe(document.querySelector('#itemView') || document.body, { childList: true, subtree: true });
}

start();
