#!/usr/bin/env node
// Render-ownership check: loads each page from production twice, as served and
// with local public/ scripts, styles and the entity shell substituted, then
// compares the settled state and counts DOM writes per page region.
//
//   npm i --no-save playwright && node scripts/check-render-ownership.mjs /places/walpole-park /issues/walpole-park-theatre
//
// Set CHROMIUM_PATH to use a pre-installed browser; HTTPS_PROXY is honoured.
import { chromium } from 'playwright';
import { readFile, access } from 'node:fs/promises';
const PUBLIC = new URL('../public', import.meta.url).pathname;
const base = String(process.env.BASE_URL || 'https://ealing.civiccommons.co.uk').replace(/\/$/, '');
const exists = p => access(p).then(() => true, () => false);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined, args: ['--disable-dev-shm-usage'] });
async function run(path, local) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  if (local) {
    await context.route(/\.(js|css)(\?|$)/, async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.continue();
      let name = url.pathname.replace(/^\/assets\//, '/').replace(/\.[0-9a-f]{10}\.(js|css)$/, '.$1');
      if (url.pathname.startsWith('/assets/')) name = '/' + name.slice(1).replace(/-/g, '/');
      const candidates = [PUBLIC + name, PUBLIC + url.pathname.replace(/^\/assets\//, '/').replace(/\.[0-9a-f]{10}\.(js|css)$/, '.$1')];
      for (const file of candidates) if (await exists(file)) return route.fulfill({ body: await readFile(file), contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript' });
      return route.continue();
    });
    if (/^\/(people|organisations|places)\//.test(path)) await context.route(base + path, async route => route.fulfill({ body: await readFile(PUBLIC + '/entity.html'), contentType: 'text/html' }));
  }
  const page = await context.newPage();
  const writes = {};
  await page.exposeFunction('__w', key => { writes[key] = (writes[key] || 0) + 1; });
  await page.addInitScript(() => {
    const watched = /^(currentItems|reporting|issueReporting|topicReporting|currentSection|reportingSection|entityStats|issueStats|topicStats|primaryIssueHub)$/;
    new MutationObserver(records => { for (const r of records) { let el = r.target.nodeType === 1 ? r.target : r.target.parentElement; while (el && !(el.id && watched.test(el.id))) el = el.parentElement; if (el) window.__w(`${el.id}:${r.type}`); } }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  await page.goto(base + path, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  const state = await Promise.race([page.evaluate(() => {
    const shown = sel => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display !== 'none' && !el.hidden : null; };
    const hrefs = sel => [...document.querySelectorAll(sel)].map(a => a.getAttribute('href'));
    return {
      currentShown: shown('#currentSection'), current: hrefs('#currentItems article h3 a'),
      reportingShown: shown('#reportingSection'), reporting: hrefs('#reporting li h3 a, #issueReporting li h3 a, #topicReporting li h3 a'),
      hub: !!document.querySelector('#primaryIssueHub'),
      actions: [...document.querySelectorAll('.entity-actions a')].map(a => a.textContent.trim()),
      stat: document.querySelector('#entityStats .entity-stat:first-child, #issueStats, #topicStats')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80)
    };
  }), new Promise(r => setTimeout(() => r({ frozen: true }), 15000))]);
  await context.close();
  return { state, writes, errors };
}
const summary = s => s.frozen ? 'FROZEN' : `current ${s.currentShown ? s.current.length : 'hidden'} | reporting ${s.reportingShown ? s.reporting.length : 'hidden'} | hub ${s.hub} | actions [${s.actions.join(', ')}] | stat "${s.stat}"`;
for (const path of process.argv.slice(2)) {
  const before = await run(path, false), after = await run(path, true);
  console.log(`\n${path}\n  before: ${summary(before.state)}\n  after:  ${summary(after.state)}`);
  console.log(`  writes before ${JSON.stringify(before.writes)}\n  writes after  ${JSON.stringify(after.writes)}`);
  if (!before.state.frozen && !after.state.frozen) {
    const lost = before.state.reporting.filter(h => !after.state.reporting.includes(h)), gained = after.state.reporting.filter(h => !before.state.reporting.includes(h));
    const curLost = before.state.current.filter(h => !after.state.current.includes(h));
    console.log(`  reporting: -${lost.length} +${gained.length}; current lost ${curLost.length}`);
    if (lost.length) console.log('   lost:', lost.slice(0, 4).join(' '));
    if (gained.length) console.log('   gained:', gained.slice(0, 4).join(' '));
  }
  if (after.errors.length || before.errors.length) console.log('  errors before', before.errors, 'after', after.errors);
}
await browser.close();
