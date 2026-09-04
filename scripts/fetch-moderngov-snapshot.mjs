import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { listingUrl, parseItems } from '../netlify/functions/moderngov-whatsnew.mjs';

const outputPath = 'public/data/moderngov-whatsnew.json';
const url = listingUrl();
const started = Date.now();

const response = await fetch(url, {
  redirect: 'follow',
  headers: {
    accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
    'accept-language': 'en-GB,en;q=0.9',
    referer: 'https://ealing.moderngov.co.uk/mgWhatsNew.aspx?bcr=1',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  }
});

if (!response.ok) {
  throw new Error(`ModernGov snapshot fetch failed: HTTP ${response.status}`);
}

const html = await response.text();
const items = parseItems(html, response.url || url);
if (!items.length) {
  throw new Error('ModernGov snapshot parser returned no supported publication updates');
}

const snapshot = {
  generatedAt: new Date().toISOString(),
  sourceUrl: response.url || url,
  fetchMs: Date.now() - started,
  items
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote ${items.length} ModernGov publication updates to ${outputPath}`);
