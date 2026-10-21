// RSS 2.0 pieces shared by the Commons' feeds (the site feed at /feed.xml and the
// personal follow feeds). Items link to their Commons page and name the original
// publisher in <source>, which remains canonical.
export function xml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function stableItemKey(id) {
  return Buffer.from(String(id ?? ''), 'utf8').toString('base64url');
}

export function sourceEntry(item, siteOrigin) {
  const key = stableItemKey(item.id);
  const commonsUrl = `${siteOrigin}/items/${encodeURIComponent(key)}`;
  const originalUrl = item.url || item.sourceHomepage || siteOrigin;
  const sourceUrl = item.sourceHomepage || originalUrl;
  const description = [item.summary || '', `Source: ${item.source}`, `Original: ${originalUrl}`].filter(Boolean).join('\n\n');
  return {
    sortDate: item.publishedAt || null,
    xml: `    <item>\n      <title>${xml(item.title)}</title>\n      <link>${xml(commonsUrl)}</link>\n      <guid isPermaLink="false">${xml(`civic-item:${key}`)}</guid>${item.publishedAt ? `\n      <pubDate>${xml(new Date(item.publishedAt).toUTCString())}</pubDate>` : ''}\n      <description>${xml(description)}</description>\n      <source url="${xml(sourceUrl)}">${xml(item.source)}</source>\n    </item>`
  };
}
