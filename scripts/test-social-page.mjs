import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const socialPage = await readFile('netlify/functions/social-page.mjs', 'utf8');
const socialEdge = await readFile('netlify/edge-functions/social-preview.js', 'utf8');

for (const token of [
  'og:type', 'og:title', 'og:description', 'og:url', 'og:image',
  'og:image:width', 'og:image:height', 'twitter:card', 'twitter:title',
  'twitter:description', 'twitter:image', 'rel="canonical"'
]) {
  assert.ok(socialPage.includes(token), `social-page is missing ${token}`);
}

assert.ok(socialPage.includes("type: 'article'"), 'item previews must use og:type=article');
assert.ok(socialPage.includes('/brand/social/'), 'item previews must use rendered social JPEGs');
assert.ok(socialEdge.includes("parts[0] === 'items'"), 'edge function must recognise civic item routes');
assert.ok(!socialEdge.includes('SOCIAL_CRAWLER'), 'item metadata must not depend on a crawler user-agent allow-list');
assert.ok(socialEdge.includes("path: ['/', '/items/*'"), 'edge function must run on item routes');
assert.ok(socialEdge.includes("onError: 'bypass'"), 'edge failures must fall back to the normal item page');

console.log('Social item preview metadata contract OK');
