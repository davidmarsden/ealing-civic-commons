#!/usr/bin/env node
// Fingerprinted, minified assets (Phase 4). Runs on dist/ after the public/ copy.
//
// Every local .js/.css that a page, script or stylesheet references is minified and
// written to /assets/<path>.<content-hash>.<ext>, and references are rewritten to
// those names (dropping the hand-maintained ?v= strings). Fingerprinted files never
// change, so they are served with a one-year immutable cache; HTML keeps
// revalidating, so a deploy is picked up on the next page load. Pages also get
// <link rel="modulepreload"> for every module they load, flattening import chains.
//
// Original files stay in dist/ unchanged, so anything still pointing at an
// unhashed path (an old cached page, the service worker, external links) works.
//
// Scripts are not merged into per-page bundles: each page's module scripts run
// independently today, so an error in one does not stop the others, and the
// render audit shows several depend on that order and isolation.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join, posix, relative } from 'node:path';
import { transform } from 'esbuild';

const DIST = process.argv[2] || 'dist';
const ASSET_DIR = 'assets';
const EXCLUDE = new Set(['/sw.js']);
// A quoted or url()-wrapped root-relative or ./-relative path to a .js/.css file,
// with an optional query string (the old ?v= cache-busters).
const REFERENCE = /(["'`(])((?:\/|\.{1,2}\/)[A-Za-z0-9_\-./]+\.(?:js|css))(?:\?[^"'`)\s]*)?(?=["'`)])/g;
const STATIC_IMPORT = /(?:^|[;\s}])(?:import|export)\s*(?:[^'"`;]*?\bfrom\s*)?["']([^"']+\.js)(?:\?[^"']*)?["']/g;

async function walk(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== ASSET_DIR) await walk(full, found); }
    else found.push(full);
  }
  return found;
}

const toWebPath = (dist, file) => `/${relative(dist, file).split('\\').join('/')}`;
const resolveRef = (ref, fromWebPath) => ref.startsWith('/') ? posix.normalize(ref) : posix.normalize(posix.join(posix.dirname(fromWebPath), ref));

export async function buildAssets({ dist = DIST } = {}) {
  const files = await walk(dist);
  const text = new Map();
  for (const file of files) {
    if (['.html', '.js', '.css'].includes(extname(file))) text.set(toWebPath(dist, file), await readFile(file, 'utf8'));
  }
  const isAsset = webPath => /\.(js|css)$/.test(webPath) && text.has(webPath) && !EXCLUDE.has(webPath);

  // Reference graph between assets, built from what pages actually load.
  const refsOf = webPath => [...text.get(webPath).matchAll(REFERENCE)].map(m => resolveRef(m[2], webPath)).filter(isAsset);
  const needed = new Set();
  const visit = webPath => { if (needed.has(webPath)) return; needed.add(webPath); for (const dep of refsOf(webPath)) visit(dep); };
  for (const page of [...text.keys()].filter(p => p.endsWith('.html'))) for (const dep of refsOf(page)) visit(dep);

  // Hash dependencies first, so each file's hash covers its rewritten references.
  const hashed = new Map();
  const rewrite = (source, fromWebPath) => source.replace(REFERENCE, (match, quote, ref) => {
    const target = hashed.get(resolveRef(ref, fromWebPath));
    return target ? `${quote}${target}` : match;
  });
  const visiting = new Set();
  const emit = async webPath => {
    if (hashed.has(webPath)) return;
    if (visiting.has(webPath)) throw new Error(`Asset reference cycle at ${webPath}`);
    visiting.add(webPath);
    for (const dep of refsOf(webPath)) await emit(dep);
    const loader = webPath.endsWith('.css') ? 'css' : 'js';
    const { code } = await transform(rewrite(text.get(webPath), webPath), { loader, minify: true, legalComments: 'none', target: 'es2022' });
    const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
    const name = webPath.slice(1).replace(/\//g, '-').replace(/\.(js|css)$/, `.${hash}.$1`);
    await mkdir(join(dist, ASSET_DIR), { recursive: true });
    await writeFile(join(dist, ASSET_DIR, name), code);
    hashed.set(webPath, `/${ASSET_DIR}/${name}`);
    visiting.delete(webPath);
  };
  for (const webPath of needed) await emit(webPath);

  // Static import closure of a module, for modulepreload hints.
  const staticImports = webPath => [...text.get(webPath).matchAll(STATIC_IMPORT)].map(m => resolveRef(m[1], webPath)).filter(isAsset);
  const closure = (roots) => { const seen = new Set(); const go = p => { if (seen.has(p)) return; seen.add(p); staticImports(p).forEach(go); }; roots.forEach(go); return [...seen]; };

  let pages = 0;
  for (const page of [...text.keys()].filter(p => p.endsWith('.html'))) {
    const source = text.get(page);
    let html = rewrite(source, page);
    const modules = [...source.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"'?]+)[^"']*["'][^>]*>|<script\b[^>]*src=["']([^"'?]+)[^"']*["'][^>]*type=["']module["'][^>]*>/gi)]
      .map(m => resolveRef(m[1] || m[2], page)).filter(isAsset);
    const preload = closure(modules).map(p => hashed.get(p)).filter(Boolean);
    if (preload.length && /<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${preload.map(href => `<link rel="modulepreload" href="${href}">`).join('\n')}\n</head>`);
    }
    if (html !== source) { await writeFile(join(dist, page.slice(1)), html); pages += 1; }
  }

  const manifest = Object.fromEntries([...hashed].sort());
  await writeFile(join(dist, ASSET_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { assets: hashed.size, pages, manifest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildAssets();
  console.log(`Fingerprinted ${result.assets} assets; rewrote ${result.pages} pages.`);
}
