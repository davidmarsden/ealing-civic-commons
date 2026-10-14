#!/usr/bin/env node
// Asset fingerprinting: references are rewritten (static and dynamic imports,
// injected stylesheets, relative paths, old ?v= strings), hashes cascade from
// dependencies, originals stay, and the real public/ tree builds consistently.
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transform } from 'esbuild';
import { buildAssets } from './build-assets.mjs';

const fixture = async files => {
  const dir = await mkdtemp(join(tmpdir(), 'assets-'));
  for (const [path, body] of Object.entries(files)) {
    await mkdir(join(dir, path, '..'), { recursive: true });
    await writeFile(join(dir, path), body);
  }
  return dir;
};
const read = (dir, path) => readFile(join(dir, path), 'utf8');

const files = {
  'index.html': '<html><head><link rel="stylesheet" href="/site.css?v=20260101-1"></head><body><script src="/shell.js?v=3"></script><script src="/app.js" type="module"></script></body></html>',
  'docs/page.html': '<html><head></head><body><script type="module" src="./doc.js"></script></body></html>',
  'docs/doc.js': "import { lib } from '../lib.js';\nconsole.log(lib);\n",
  'app.js': "import { lib } from './lib.js';\nconst later = () => import('/lazy.js?v=2');\nconst style = '/extra.css?v=3';\nexport { later, style, lib };\n",
  'lib.js': "export const lib = 'first';\n",
  'lazy.js': 'export default 1;\n',
  'shell.js': "window.shellLoaded = true;\nnavigator.serviceWorker?.register('/sw.js');\n",
  'site.css': 'body { color: red; }\n',
  'extra.css': '.x { margin: 0; }\n',
  'sw.js': "self.addEventListener('fetch', () => {});\n",
  'unreferenced.js': 'console.log(1);\n'
};
const dir = await fixture(files);
const { manifest } = await buildAssets({ dist: dir });

assert.deepEqual(Object.keys(manifest).sort(), ['/app.js', '/docs/doc.js', '/extra.css', '/lazy.js', '/lib.js', '/shell.js', '/site.css']);
assert.ok(!manifest['/sw.js'] && !manifest['/unreferenced.js'], 'service worker and unreferenced files are left alone');
for (const target of Object.values(manifest)) assert.match(target, /^\/assets\/[\w-]+\.[0-9a-f]{10}\.(js|css)$/);
assert.equal(manifest['/docs/doc.js'].startsWith('/assets/docs-doc.'), true, 'subdirectory paths are flattened');

const index = await read(dir, 'index.html');
assert.ok(index.includes(`href="${manifest['/site.css']}"`) && !index.includes('?v='), 'stylesheet rewritten, ?v= dropped');
assert.ok(index.includes(`src="${manifest['/shell.js']}"`) && index.includes(`src="${manifest['/app.js']}"`));
assert.ok(index.includes(`<link rel="modulepreload" href="${manifest['/app.js']}">`) && index.includes(`<link rel="modulepreload" href="${manifest['/lib.js']}">`), 'static import closure preloaded');
assert.ok(!index.includes(`modulepreload" href="${manifest['/lazy.js']}`), 'dynamic imports are not preloaded');
assert.ok(!index.includes(`modulepreload" href="${manifest['/shell.js']}`), 'classic scripts are not modulepreloaded');

const app = await read(dir, manifest['/app.js']);
for (const dep of ['/lib.js', '/lazy.js', '/extra.css']) assert.ok(app.includes(manifest[dep]), `app references hashed ${dep}`);
assert.ok((await read(dir, manifest['/docs/doc.js'])).includes(manifest['/lib.js']), 'relative ../ imports resolve');
assert.ok((await read(dir, 'docs/page.html')).includes(`src="${manifest['/docs/doc.js']}"`), 'relative ./ page references resolve');
assert.ok((await read(dir, manifest['/shell.js'])).includes("'/sw.js'") || (await read(dir, manifest['/shell.js'])).includes('"/sw.js"'), 'service worker URL unchanged');
assert.equal(await read(dir, 'app.js'), files['app.js'], 'originals stay in place');

// Changing a dependency changes the hash of everything that imports it.
const changed = await fixture({ ...files, 'lib.js': "export const lib = 'second';\n" });
const { manifest: next } = await buildAssets({ dist: changed });
assert.notEqual(next['/lib.js'], manifest['/lib.js']);
assert.notEqual(next['/app.js'], manifest['/app.js'], 'importer hash cascades');
assert.equal(next['/site.css'], manifest['/site.css'], 'unrelated assets keep their names');
await Promise.all([dir, changed].map(path => rm(path, { recursive: true, force: true })));

// The real site: every /assets/ reference resolves and every output parses.
const real = await mkdtemp(join(tmpdir(), 'assets-public-'));
await cp(new URL('../public', import.meta.url), real, { recursive: true });
const result = await buildAssets({ dist: real });
assert.ok(result.assets > 40, `fingerprinted ${result.assets} assets`);
const outputs = new Set(Object.values(result.manifest));
const walk = async (path, found = []) => { for (const entry of await readdir(path, { withFileTypes: true })) { const full = join(path, entry.name); entry.isDirectory() ? await walk(full, found) : found.push(full); } return found; };
for (const file of await walk(real)) {
  if (!/\.(html|js|css)$/.test(file)) continue;
  for (const [ref] of (await readFile(file, 'utf8')).matchAll(/\/assets\/[\w.-]+\.(?:js|css)/g)) assert.ok(outputs.has(ref), `${file} references missing ${ref}`);
}
for (const target of outputs) {
  await transform(await read(real, target), { loader: target.endsWith('.css') ? 'css' : 'js' });
}
await rm(real, { recursive: true, force: true });

console.log(`Asset build: rewriting, preloads, hash cascade and ${result.assets} real assets OK.`);
