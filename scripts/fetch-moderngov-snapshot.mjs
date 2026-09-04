import { listingUrl } from '../netlify/functions/moderngov-whatsnew.mjs';

const directUrl = listingUrl();
const feedUrl = 'https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0';
const bridgeUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;

const direct = await fetch(directUrl, { redirect: 'follow' });
console.log(`ModernGov direct: HTTP ${direct.status}`);

const response = await fetch(bridgeUrl, {
  redirect: 'follow',
  headers: { accept: 'application/json', 'user-agent': 'Ealing-Civic-Commons/1.0' }
});
console.log(`rss2json: HTTP ${response.status}`);
const body = await response.text();
let data = null;
try { data = JSON.parse(body); } catch {}
if (data) {
  console.log(`rss2json status=${data.status || 'unknown'} items=${Array.isArray(data.items) ? data.items.length : 0}`);
  console.log(`rss2json message=${data.message || ''}`);
  console.log(`rss2json first=${JSON.stringify(data.items?.[0] || data.feed || {}).slice(0, 1500)}`);
} else {
  console.log(`rss2json body=${body.slice(0, 1500)}`);
}

if (!response.ok || data?.status !== 'ok' || !Array.isArray(data.items) || !data.items.length) {
  throw new Error('RSS bridge did not return ModernGov items');
}

throw new Error('RSS bridge probe succeeded; inspect sample and replace probe with normalizer');
