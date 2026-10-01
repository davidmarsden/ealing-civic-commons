function jsonValue(value, inArray = false) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return inArray ? null : undefined;
  if (value === null || typeof value !== 'object') return value;
  if (typeof value.toJSON === 'function') return jsonValue(value.toJSON(), inArray);
  if (Array.isArray(value)) return value.map(entry => jsonValue(entry, true));
  const result = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = jsonValue(value[key], false);
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
}

export function stableJson(value) {
  return JSON.stringify(jsonValue(value));
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
