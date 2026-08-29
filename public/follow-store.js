export const FOLLOW_STORAGE_KEY = 'civic-commons:follows:v1';

const followTypes = ['items', 'towns', 'topics', 'sources'];
const emptyState = () => ({ version: 1, items: [], towns: [], topics: [], sources: [] });

function normaliseEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = String(entry.id ?? '').trim();
  if (!id) return null;
  return { id, label: String(entry.label ?? id).trim() || id };
}

export function stableItemKey(id) {
  const bytes = new TextEncoder().encode(String(id ?? ''));
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function loadFollows() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLLOW_STORAGE_KEY) || 'null');
    if (!parsed || parsed.version !== 1) return emptyState();
    const state = emptyState();
    followTypes.forEach(type => {
      state[type] = Array.isArray(parsed[type])
        ? parsed[type].map(normaliseEntry).filter(Boolean).filter((entry, index, list) => list.findIndex(candidate => candidate.id === entry.id) === index)
        : [];
    });
    return state;
  } catch {
    return emptyState();
  }
}

function saveFollows(state) {
  try {
    localStorage.setItem(FOLLOW_STORAGE_KEY, JSON.stringify(state));
  } catch {
    return false;
  }
  window.dispatchEvent(new CustomEvent('civic-follows-changed', { detail: state }));
  return true;
}

export function isFollowing(type, id) {
  return loadFollows()[type]?.some(entry => entry.id === String(id)) || false;
}

export function toggleFollow(type, id, label) {
  if (!followTypes.includes(type)) return loadFollows();
  const key = String(id ?? '').trim();
  if (!key) return loadFollows();
  const state = loadFollows();
  const index = state[type].findIndex(entry => entry.id === key);
  if (index >= 0) state[type].splice(index, 1);
  else state[type].push({ id: key, label: String(label ?? key).trim() || key });
  saveFollows(state);
  return state;
}

export function clearFollows() {
  const state = emptyState();
  saveFollows(state);
  return state;
}

export function followCount(state = loadFollows()) {
  return followTypes.reduce((total, type) => total + (state[type]?.length || 0), 0);
}

export function itemMatchesFollows(item, state = loadFollows()) {
  if (!item) return false;
  const key = stableItemKey(item.id);
  if (state.items.some(entry => entry.id === key)) return true;
  if (state.sources.some(entry => entry.id === item.sourceId)) return true;
  if (item.boroughWide === true && state.towns.length) return true;
  if ((item.towns || []).some(town => state.towns.some(entry => entry.id === town))) return true;
  if ((item.topics || []).some(topic => state.topics.some(entry => entry.id === topic))) return true;
  return false;
}
