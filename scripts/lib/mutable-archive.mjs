export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function sameItem(a, b) {
  return stableJson(a) === stableJson(b);
}

export function mergeMutableRecord(existing, nextItem, now = new Date().toISOString()) {
  if (!existing) return { action: 'insert', record: { version: 1, firstSeenAt: now, updatedAt: now, revisions: [], item: nextItem } };
  if (sameItem(existing.item, nextItem)) return { action: 'unchanged', record: existing };
  const revisions = Array.isArray(existing.revisions) ? existing.revisions : [];
  return {
    action: 'update',
    record: {
      ...existing,
      version: Math.max(1, Number(existing.version) || 1) + 1,
      firstSeenAt: existing.firstSeenAt || existing.archivedAt || now,
      updatedAt: now,
      revisions: [...revisions, { capturedAt: existing.updatedAt || existing.archivedAt || now, item: existing.item }].slice(-20),
      item: nextItem,
    },
  };
}
