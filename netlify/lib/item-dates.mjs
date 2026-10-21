// Publication dates that cannot be true. A date more than a day after the moment
// the timeline is built is a publisher's mistake (in October 2026 the Met's
// Southall West priorities page said "Issued 20 November 2026"); taken at face
// value it pins the item to the top of the timeline and of feed readers for
// weeks. Such an item is kept but treated as undated; the claimed date stays on
// the item as `claimedPublishedAt` so nothing is hidden.
export const FUTURE_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

export function withPlausibleDate(item, now = Date.now()) {
  const time = Date.parse(item?.publishedAt || '');
  if (!Number.isFinite(time) || time <= now + FUTURE_DATE_TOLERANCE_MS) return item;
  return { ...item, publishedAt: null, claimedPublishedAt: item.publishedAt };
}
