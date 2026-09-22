#!/usr/bin/env node
/**
 * Re-applies the Ealing Civic Commons server overlay to a pristine rss.chat
 * server/code/rssnetwork.js.
 *
 * Baseline tested against scripting/rss.chat:
 * 0a77f7b0cdb6d61291248ded69daa6b78f10860a (rss.chat v0.6.14)
 *
 * Usage:
 *   node apply-overlay.mjs /opt/rsschat/rssnetwork.js
 *
 * This is intentionally fail-closed: if an upstream edit removes an anchor,
 * the script stops rather than leaving a half-patched server.
 */

import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node apply-overlay.mjs /path/to/rssnetwork.js');
  process.exit(2);
}

let source = fs.readFileSync(target, 'utf8');

if (source.includes('COMMONS CHAT OVERLAY: civic bindings')) {
  console.log('Commons Chat overlay already present; no changes made.');
  process.exit(0);
}

const changes = [];

function replaceOnce(label, from, to) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error('Overlay anchor not found: ' + label);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error('Overlay anchor is not unique: ' + label);
  }
  source = source.replace(from, to);
  changes.push(label);
}

replaceOnce(
  'product identity',
  'var myVersion = "0.6.14", myProductName = "rss.network";',
  'var myVersion = "0.6.14", myProductName = "Commons Chat"; // COMMONS CHAT OVERLAY: product identity'
);

replaceOnce(
  'fresh database schema',
  '"create table if not exists items (id integer primary key, feedUrl text, author text collate nocase, inReplyTo integer, title text, link text, description text, pubDate text, enclosureUrl text, enclosureType text, enclosureLength integer, whenCreated text default current_timestamp, whenUpdated text default current_timestamp, markdowntext text, outlineJsontext text, flDeleted integer not null default 0);",',
  '"create table if not exists items (id integer primary key, feedUrl text, author text collate nocase, inReplyTo integer, title text, link text, description text, pubDate text, enclosureUrl text, enclosureType text, enclosureLength integer, whenCreated text default current_timestamp, whenUpdated text default current_timestamp, markdowntext text, outlineJsontext text, commonsObjectUrl text, commonsObjectType text, flDeleted integer not null default 0);", // COMMONS CHAT OVERLAY: civic bindings'
);

replaceOnce(
  'convertItem civic fields',
  '\t\t\tctReplies: convertNumber (theItem.ctReplies), //7/3/26 by CC\n',
  '\t\t\tctReplies: convertNumber (theItem.ctReplies), //7/3/26 by CC\n' +
  '\t\t\tcommonsObjectUrl: convertString (theItem.commonsObjectUrl), // COMMONS CHAT OVERLAY\n' +
  '\t\t\tcommonsObjectType: convertString (theItem.commonsObjectType), // COMMONS CHAT OVERLAY\n'
);

replaceOnce(
  'addItem civic fields',
  '\t\t\toutlineJsontext: itemRec.outlineJsontext,\n\t\t\tauthor: itemRec.author, //5/4/26 by DW\n',
  '\t\t\toutlineJsontext: itemRec.outlineJsontext,\n' +
  '\t\t\tcommonsObjectUrl: itemRec.commonsObjectUrl, // COMMONS CHAT OVERLAY\n' +
  '\t\t\tcommonsObjectType: itemRec.commonsObjectType, // COMMONS CHAT OVERLAY\n' +
  '\t\t\tauthor: itemRec.author, //5/4/26 by DW\n'
);

replaceOnce(
  'updateItem civic fields',
  '\t\t\tadd ("outlineJsontext", itemRec.outlineJsontext);\n\t\t\tadd ("author", itemRec.author);\n',
  '\t\t\tadd ("outlineJsontext", itemRec.outlineJsontext);\n' +
  '\t\t\tadd ("commonsObjectUrl", itemRec.commonsObjectUrl); // COMMONS CHAT OVERLAY\n' +
  '\t\t\tadd ("commonsObjectType", itemRec.commonsObjectType); // COMMONS CHAT OVERLAY\n' +
  '\t\t\tadd ("author", itemRec.author);\n'
);

replaceOnce(
  'newPost civic fields',
  '\t\t\t\t\t\t\t\t\tmarkdowntext: trimTrailingBlankLines (postRec.markdowntext), //6/3/26 by DW; 7/20/26 by CC -- #192\n\t\t\t\t\t\t\t\t\tinReplyTo: postRec.inReplyTo,\n',
  '\t\t\t\t\t\t\t\t\tmarkdowntext: trimTrailingBlankLines (postRec.markdowntext), //6/3/26 by DW; 7/20/26 by CC -- #192\n' +
  '\t\t\t\t\t\t\t\t\tcommonsObjectUrl: postRec.commonsObjectUrl, // COMMONS CHAT OVERLAY\n' +
  '\t\t\t\t\t\t\t\t\tcommonsObjectType: postRec.commonsObjectType, // COMMONS CHAT OVERLAY\n' +
  '\t\t\t\t\t\t\t\t\tinReplyTo: postRec.inReplyTo,\n'
);

replaceOnce(
  'feed defaults identity',
  '\t\theadElements.title = userRec.screenname + " on rss.network";\n\t\theadElements.link = config.urlServerForClient; //8/2/26 by DW\n\t\theadElements.description = "Posts by " + userRec.screenname + " on rss.network";\n',
  '\t\theadElements.title = userRec.screenname + " on " + config.productNameForDisplay; // COMMONS CHAT OVERLAY\n' +
  '\t\theadElements.link = config.urlServerForClient; //8/2/26 by DW\n' +
  '\t\theadElements.description = "Posts by " + userRec.screenname + " on " + config.productNameForDisplay; // COMMONS CHAT OVERLAY\n'
);

const helperAnchor = '\tfunction httpRequest (url, timeout, headers, callback) { //7/30/26 by DW\n';
const helperIndex = source.indexOf(helperAnchor);
if (helperIndex < 0) throw new Error('Overlay anchor not found: helper insertion');

const helperBlock = [
  '\t// COMMONS CHAT OVERLAY: civic bindings',
  '\tfunction escapeXmlAttribute (value) {',
  '\t\treturn (String (value)',
  '\t\t\t.replace (/&/g, "&amp;")',
  '\t\t\t.replace (/"/g, "&quot;")',
  '\t\t\t.replace (/</g, "&lt;")',
  '\t\t\t.replace (/>/g, "&gt;"));',
  '\t\t}',
  '\tfunction addCommonsBindingsToRss (xmltext, items) {',
  '\t\tconst boundItems = (items || []).filter (item => item.commonsObjectUrl !== undefined);',
  '\t\tif (boundItems.length === 0) {',
  '\t\t\treturn (xmltext);',
  '\t\t\t}',
  '\t\tif (xmltext.indexOf ("xmlns:commons=") < 0) {',
  `\t\t\txmltext = xmltext.replace ("<rss", \'<rss xmlns:commons="https://civiccommons.co.uk/ns/commons-chat/1.0">\');`,
  '\t\t\t}',
  '\t\tvar ix = 0;',
  '\t\txmltext = xmltext.replace (/<item>([\\s\\S]*?)<\\/item>/g, function (whole, inner) {',
  '\t\t\tconst item = items [ix++];',
  '\t\t\tif ((item === undefined) || (item.commonsObjectUrl === undefined)) {',
  '\t\t\t\treturn (whole);',
  '\t\t\t\t}',
  '\t\t\tconst theType = (item.commonsObjectType === undefined) ? "item" : item.commonsObjectType;',
  `\t\t\tconst element = \'<commons:object url="\' + escapeXmlAttribute (item.commonsObjectUrl) + \'" type="\' + escapeXmlAttribute (theType) + \'"/>\';`,
  '\t\t\treturn ("<item>" + inner + element + "</item>");',
  '\t\t\t});',
  '\t\treturn (xmltext);',
  '\t\t}',
  '\tfunction localBindCommons (id, objectUrl, objectType, callback) {',
  '\t\tconst numericId = Number (id);',
  '\t\tif ((!Number.isInteger (numericId)) || (numericId <= 0)) {',
  '\t\t\tcallback ({message: "A valid post id is required."});',
  '\t\t\treturn;',
  '\t\t\t}',
  '\t\ttry {',
  '\t\t\tconst parsed = new URL (objectUrl);',
  '\t\t\tif ((parsed.protocol !== "https:") || (parsed.hostname !== "ealing.civiccommons.co.uk")) {',
  '\t\t\t\tthrow new Error ("Not a Civic Commons URL.");',
  '\t\t\t\t}',
  '\t\t\t}',
  '\t\tcatch (err) {',
  '\t\t\tcallback ({message: "A valid Ealing Civic Commons https URL is required."});',
  '\t\t\treturn;',
  '\t\t\t}',
  '\t\tconst cleanType = String (objectType || "item").trim ().slice (0, 80);',
  '\t\tconst sqltext = "update items set commonsObjectUrl = " + davesql.encode (objectUrl) +',
  '\t\t\t", commonsObjectType = " + davesql.encode (cleanType) +',
  '\t\t\t" where id = " + davesql.encode (numericId) + ";";',
  '\t\tdavesql.runSqltext (sqltext, function (err, result) {',
  '\t\t\tif (err) {',
  '\t\t\t\tcallback (err);',
  '\t\t\t\t}',
  '\t\t\telse if (result.affectedRows === 0) {',
  '\t\t\t\tcallback ({message: "No post exists with id " + numericId + "."});',
  '\t\t\t\t}',
  '\t\t\telse {',
  '\t\t\t\tgetItemById (undefined, numericId, callback);',
  '\t\t\t\t}',
  '\t\t\t});',
  '\t\t}',
  '\tfunction getCommonsDiscussions (objectUrl, callback) {',
  '\t\tif ((objectUrl === undefined) || (objectUrl.length === 0)) {',
  '\t\t\tcallback ({message: "A Civic Commons object URL is required."});',
  '\t\t\treturn;',
  '\t\t\t}',
  '\t\tconst encodedUrl = davesql.encode (objectUrl);',
  '\t\tconst sqltext = [',
  '\t\t\t"with recursive",',
  '\t\t\t"roots as (",',
  '\t\t\t" select * from items",',
  '\t\t\t" where commonsObjectUrl = " + encodedUrl,',
  '\t\t\t" and inReplyTo is null",',
  '\t\t\t" and (flDeleted is null or flDeleted = 0)",',
  '\t\t\t" order by pubDate desc limit 8",',
  '\t\t\t"),",',
  '\t\t\t"tree (rootId, id) as (",',
  '\t\t\t" select id, id from roots",',
  '\t\t\t" union",',
  '\t\t\t" select tree.rootId, child.id from items child join tree on child.inReplyTo = tree.id",',
  '\t\t\t" where (child.flDeleted is null or child.flDeleted = 0)",',
  '\t\t\t"),",',
  '\t\t\t"counts as (select rootId, count (*) as ctPosts from tree group by rootId)",',
  '\t\t\t"select roots.*,",',
  `\t\t\t" users.prefs ->> '$.myAvatarImageUrl' as imageUrl,",`,
  `\t\t\t" users.prefs ->> '$.myFeedTitle' as feedTitle,",`,
  `\t\t\t" users.prefs ->> '$.myFeedLink' as feedLink,",`,
  `\t\t\t" users.prefs ->> '$.myFeedDescription' as feedDescription,",`,
  '\t\t\t" (select count(*) from likes where likes.itemId = roots.id) as ctLikes,",',
  '\t\t\t" (select count(*) from items c where c.inReplyTo = roots.id and (c.flDeleted is null or c.flDeleted = 0)) as ctReplies,",',
  '\t\t\t" counts.ctPosts",',
  '\t\t\t"from roots",',
  '\t\t\t"left join users on users.screenname = roots.author",',
  '\t\t\t"left join counts on counts.rootId = roots.id",',
  '\t\t\t"order by roots.pubDate desc;"',
  '\t\t\t].join ("\\n");',
  '\t\tdavesql.runSqltext (sqltext, function (err, result) {',
  '\t\t\tif (err) {',
  '\t\t\t\tcallback (err);',
  '\t\t\t\t}',
  '\t\t\telse {',
  '\t\t\t\tconst threads = result.map (function (row) {',
  '\t\t\t\t\tconst item = convertItem (row);',
  '\t\t\t\t\titem.ctPosts = Number (row.ctPosts || 1);',
  '\t\t\t\t\treturn (item);',
  '\t\t\t\t\t});',
  '\t\t\t\tconst postCount = threads.reduce ((total, item) => total + item.ctPosts, 0);',
  '\t\t\t\tcallback (undefined, {objectUrl, conversationCount: threads.length, postCount, threads});',
  '\t\t\t\t}',
  '\t\t\t});',
  '\t\t}',
  '',
  ''
].join('\n');

source = source.slice(0, helperIndex) + helperBlock + source.slice(helperIndex);
changes.push('civic helper functions');

replaceOnce(
  'user RSS binding injection',
  '\t\t\t\tif (lowerformat === "xml") {\n\t\t\t\t\txmltext = rss.buildRssFeed (headElements, feedItems);\n\t\t\t\t\tcallback (undefined, xmltext, lowerformat);\n',
  '\t\t\t\tif (lowerformat === "xml") {\n' +
  '\t\t\t\t\txmltext = rss.buildRssFeed (headElements, feedItems);\n' +
  '\t\t\t\t\txmltext = addCommonsBindingsToRss (xmltext, items); // COMMONS CHAT OVERLAY\n' +
  '\t\t\t\t\tcallback (undefined, xmltext, lowerformat);\n'
);

replaceOnce(
  'comments RSS binding injection',
  '\t\t\t\t\t\tconst feedItems = buildFeedItems (replies, true); //7/8/26 by DW -- include <source> attributions\n\t\t\t\t\t\tconst xmltext = rss.buildRssFeed (headElements, feedItems);\n\t\t\t\t\t\tcallback (undefined, xmltext, parentItem);\n',
  '\t\t\t\t\t\tconst feedItems = buildFeedItems (replies, true); //7/8/26 by DW -- include <source> attributions\n' +
  '\t\t\t\t\t\tconst xmltext = addCommonsBindingsToRss (rss.buildRssFeed (headElements, feedItems), replies); // COMMONS CHAT OVERLAY\n' +
  '\t\t\t\t\t\tcallback (undefined, xmltext, parentItem);\n'
);

replaceOnce(
  'everyone RSS binding injection',
  '\t\t\t\tconst feedItems = buildFeedItems (items, true); //7/8/26 by DW -- add source elements to indicate who the author is\n\t\t\t\tconst xmltext = rss.buildRssFeed (headElements, feedItems);\n',
  '\t\t\t\tconst feedItems = buildFeedItems (items, true); //7/8/26 by DW -- add source elements to indicate who the author is\n' +
  '\t\t\t\tconst xmltext = addCommonsBindingsToRss (rss.buildRssFeed (headElements, feedItems), items); // COMMONS CHAT OVERLAY\n'
);

replaceOnce(
  'pwa routes',
  '\t\tcase "/feed":\n',
  '\t\tcase "/manifest.webmanifest": // COMMONS CHAT OVERLAY: PWA\n' +
  '\t\t\ttheRequest.httpReturn (200, "application/manifest+json", JSON.stringify ({\n' +
  '\t\t\t\tname: "Commons Chat — Ealing Civic Commons",\n' +
  '\t\t\t\tshort_name: "Commons Chat",\n' +
  '\t\t\t\tdescription: "Public local conversations connected to the civic record across Ealing.",\n' +
  '\t\t\t\tstart_url: "/",\n' +
  '\t\t\t\tscope: "/",\n' +
  '\t\t\t\tdisplay: "standalone",\n' +
  '\t\t\t\tbackground_color: "#f6f4ee",\n' +
  '\t\t\t\ttheme_color: "#0f4a37",\n' +
  '\t\t\t\ticons: [{src: "https://ealing.civiccommons.co.uk/brand/ealing-pwa-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any"}, {src: "https://ealing.civiccommons.co.uk/brand/ealing-pwa-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any"}]\n' +
  '\t\t\t\t}), {"cache-control": "public, max-age=3600"});\n' +
  '\t\t\treturn (true);\n' +
  '\t\tcase "/sw.js": // COMMONS CHAT OVERLAY: PWA\n' +
  '\t\t\tconst sw = [\n' +
  '\t\t\t\t"const CACHE = \\\"commons-chat-pwa-v1\\\";",\n' +
  '\t\t\t\t"self.addEventListener(\\\"install\\\", event => { event.waitUntil(caches.open(CACHE).then(cache => cache.add(\\\"/\\\")).catch(() => undefined)); self.skipWaiting(); });",\n' +
  '\t\t\t\t"self.addEventListener(\\\"activate\\\", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });",\n' +
  '\t\t\t\t"self.addEventListener(\\\"fetch\\\", event => { const req = event.request; if (req.method !== \\\"GET\\\") return; const url = new URL(req.url); if (url.origin !== self.location.origin) return; if (req.mode === \\\"navigate\\\") { event.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); return res; }).catch(async () => (await caches.match(req)) || (await caches.match(\\\"/\\\")) || new Response(\\\"Commons Chat is offline. Reconnect to load conversations.\\\", {headers:{\\\"content-type\\\":\\\"text/plain; charset=utf-8\\\"}}))); } });"\n' +
  '\t\t\t\t].join ("\\n");\n' +
  '\t\t\ttheRequest.httpReturn (200, "application/javascript", sw, {"cache-control": "no-cache", "service-worker-allowed": "/"});\n' +
  '\t\t\treturn (true);\n' +
  '\t\tcase "/feed":\n'
);

replaceOnce(
  'discussion route',
  '\t\tcase "/getrecentitems": //4/29/26 by DW\n\t\t\tgetRecentItems (params.screenname, params.ct, httpReturn);\n\t\t\treturn (true);\n',
  '\t\tcase "/getrecentitems": //4/29/26 by DW\n' +
  '\t\t\tgetRecentItems (params.screenname, params.ct, httpReturn);\n' +
  '\t\t\treturn (true);\n' +
  '\t\tcase "/getcommonsdiscussions": // COMMONS CHAT OVERLAY\n' +
  '\t\t\tgetCommonsDiscussions (params.url, httpReturn);\n' +
  '\t\t\treturn (true);\n'
);

replaceOnce(
  'local binding route',
  '\t\tcase "/localnewuser": //7/29/26 by CC -- #205\n',
  '\t\tcase "/localbindcommons": // COMMONS CHAT OVERLAY -- localhost maintenance only\n' +
  '\t\t\tif (requestIsFromThisMachine (theRequest)) {\n' +
  '\t\t\t\tlocalBindCommons (params.id, params.url, params.type, httpReturn);\n' +
  '\t\t\t\t}\n' +
  '\t\t\telse {\n' +
  '\t\t\t\treturnError ({message: "localbindcommons only works from the server machine."});\n' +
  '\t\t\t\t}\n' +
  '\t\t\treturn (true);\n' +
  '\t\tcase "/localnewuser": //7/29/26 by CC -- #205\n'
);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = target + '.pre-commons-overlay-' + timestamp;
fs.copyFileSync(target, backup);
fs.writeFileSync(target, source);

console.log('Patched ' + path.resolve(target));
console.log('Backup: ' + backup);
console.log('Applied ' + changes.length + ' overlay changes:');
changes.forEach(change => console.log('  - ' + change));
