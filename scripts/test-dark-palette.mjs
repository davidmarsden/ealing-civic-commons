#!/usr/bin/env node
// Tests for the dark-mode palette and the appearance bootstrap.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { darkCounterpart, parseColor, run, sources, transformCss } from './dark-palette.mjs';

const luminance = ({ r, g, b }) => {
  const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
const DARK_PAPER = parseColor('#172321'), DARK_CARD = parseColor('#273733');

// Parsing.
assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
assert.deepEqual(parseColor('rgba(31,91,66,.08)'), { r: 31, g: 91, b: 66, a: .08 });
assert.deepEqual(parseColor('white'), { r: 255, g: 255, b: 255, a: 1 });

// Literals that already work on a dark page are left alone.
assert.equal(darkCounterpart('fg', parseColor('#fff')), null, 'white text sits on fills');
assert.equal(darkCounterpart('bg', parseColor('#173f30')), null, 'dark fills stay');

// Text that is dark becomes readable on dark surfaces.
for (const literal of ['#505a54', '#18221d', '#8f471d', '#b64d43', '#3e865f', '#666', '#a5aaa6']) {
  const dark = parseColor(darkCounterpart('fg', parseColor(literal)));
  assert.ok(contrast(dark, DARK_PAPER) >= 4.5, `${literal} on paper: ${contrast(dark, DARK_PAPER).toFixed(2)}`);
  assert.ok(contrast(dark, DARK_CARD) >= 4.5, `${literal} on card: ${contrast(dark, DARK_CARD).toFixed(2)}`);
}
// Light surfaces become dark ones on which the dark-mode ink reads.
for (const literal of ['#fff', '#fffdf8', '#efede5', '#f3e4d8', '#dceadf', '#c5e4cd']) {
  const dark = parseColor(darkCounterpart('bg', parseColor(literal)));
  assert.ok(contrast(parseColor('#e5eee8'), dark) >= 7, `ink on ${literal}`);
  assert.ok(contrast(parseColor('#b6c7c0'), dark) >= 4.5, `muted on ${literal}`);
}

// Rewriting keeps the literal as the light-mode fallback, skips :root and is idempotent.
const sample = ':root{--x:#fff}.a{color:#505a54;background:#fff;border:1px solid #d9d8cf}.b{background:var(--green);color:#fff}/* #000 */';
const once = transformCss(sample);
assert.match(once.css, /:root\{--x:#fff\}/);
assert.match(once.css, /color:var\(--dark-fg-505a54, #505a54\)/);
assert.match(once.css, /background:var\(--dark-bg-fff, #fff\)/);
assert.match(once.css, /border:1px solid var\(--dark-line-d9d8cf, #d9d8cf\)/);
assert.match(once.css, /\.b\{background:var\(--fill-green, var\(--green\)\);color:#fff\}/);
assert.match(once.css, /\/\* #000 \*\//);
const twice = transformCss(once.css);
assert.equal(twice.css, once.css);
assert.deepEqual([...twice.tokens], [...once.tokens]);

// The repository's stylesheets and palette are up to date.
const { changedFiles } = await run({ check: true });
assert.deepEqual(changedFiles, [], `run node scripts/dark-palette.mjs (${changedFiles.join(', ')})`);

// Every page sets its theme in <head> before any stylesheet, so there is no flash
// of the light theme for dark-mode readers.
// Pages are those the palette covers: every page that loads the site shell.
const { pages } = await sources();
for (const file of await readdir('public', { recursive: true })) {
  const path = `public/${file}`;
  if (path.endsWith('.html') && !path.startsWith('public/data/') && (await readFile(path, 'utf8')).includes('site-shell.js')) assert.ok(pages.includes(path), `${path} loads the site shell but is not covered`);
}
for (const name of pages) {
  const html = await readFile(name, 'utf8');
  const head = html.slice(0, html.search(/<\/head>|<body/i));
  const boot = head.indexOf('data-appearance-boot');
  assert.ok(boot >= 0, `${name}: appearance bootstrap in <head>`);
  const firstStylesheet = head.search(/<link[^>]+rel="stylesheet"/);
  assert.ok(firstStylesheet < 0 || boot < firstStylesheet, `${name}: bootstrap before stylesheets`);
  assert.match(head, /href="\/appearance\.css"/, `${name}: appearance.css in <head>`);
  assert.match(head, /src="\/appearance\.js"/, `${name}: appearance.js in <head>`);
}

console.log('dark palette tests passed');
