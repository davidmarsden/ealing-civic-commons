# Performance & scaling plan

Status: see the verification ledger (§0). Nothing counts as solved until it is verified in production. Complements `RENDER-ARCHITECTURE-AUDIT.md` (client rendering) and `technical-architecture-spec-v0.1.md`.

## 0. Verification ledger

Three separate states, updated as evidence arrives. *Implemented* = merged-ready code with tests; *Verified on preview* = measured on a Netlify deploy preview with real Blobs and CDN; *Verified in production* = measured on production after merge.

| Change | PR | Implemented | Verified on preview | Verified in production |
|--------|----|-------------|---------------------|------------------------|
| Archive metadata index + index-backed `listArchivedItems` | #165 | Yes: unit tests (stub store) and end-to-end tests against the real `@netlify/blobs` client with its local server | **Yes** (14 Oct 2026): 2,260 production items copied to the preview store; all 13 comparison cases identical to the full scan; full 23-page walk with 0 duplicates and 0 missing, newest first | **Yes** (14 Oct 2026): index completed by the second scheduled run (10:15–10:16 UTC: 2,000 + 260 backfilled); `civic-archive` medians 0.54–0.62 s, down from 2.4–2.8 s; the last page (offset 2,200) is correct |
| Etag reconciliation, pruning, explicit read failures | #165 | Yes (tests above) | **Yes**: index completed in 2 passes (2,000 + 260); steady state 2 listings, 2 index reads, 0 writes, ~0.4 s | **Yes**: steady state 0.48 s with no writes; a run with one new item took 0.84 s (stored, indexed, still complete); overlapping duplicate runs (below) left the index correct |
| Single feed build per email dispatch | #165, #166 | Yes (smoke test) | n/a (needs subscribers and mail config) | **Partly**: with the snapshot, dispatch runs take 1.2–3.1 s, one per slot (before #166: about 26 s, timed out at 15 s and retried). Rendering for active subscribers is still to be confirmed |
| Durable CDN caching; errors not cached | #165 | Yes | **Yes**: `Cache-Status: "Netlify Durable"; … stored` on the preview vs `fwd=bypass` on production; a 405 error is `no-store` and not stored | **Yes**: production now shows `"Netlify Durable"; … stored`; the 405 error stays `no-store` and is not stored |
| `social-preview` edge caching | #165 | Yes | **Yes**: entity page stored in the durable cache; repeat request is an edge hit | **Yes**: `/places/walpole-park` is stored in the durable cache and a repeat request is an edge hit |
| Browser feed fetches without `no-store` | #165 | Yes | Not measured (browser-side) | Pending |
| Phase 2: background ingest (`feed-ingest`), scheduled trigger returns at once, run lock and minimum interval | #166 | Yes: `scripts/test-feed-snapshot.mjs` (real Blobs client) | **Yes** (14 Oct 2026): POST returned 202 in 0.5 s; the background run built the feed in 17.3 s, wrote the snapshot and archived 1,572 items into the preview store in 11 s; a second POST two minutes later did no work (the snapshot kept the first run's `runId`) | **Yes** (14 Oct 2026): slots at 11:45, 12:00 and 12:15 each show one scheduled trigger (204 in about 1.6 s) and one ingest, with no 499 retries; feed build 16.3–27.3 s in the background; archive step 0.5–0.56 s |
| Phase 2: `combined-feed` serves the snapshot (live fallback if missing or older than 60 min) | #166 | Yes (tests above) | **Yes**: before the first ingest it built live (`reason: no snapshot`); afterwards it served the snapshot in **0.52–0.85 s, vs 10.2–29.2 s on production**, interleaved, 5 samples each | **Yes**: production `combined-feed` is served from the snapshot (`servedFrom: snapshot`). Cache-busted median 0.62 s over 6 samples (0.46–2.44 s), against 10–29 s before |
| Phase 2: source states (current / no new records / unavailable / ingestion failed), last-good items served and labelled stale | #166 | Yes (tests above) | **Yes**: 71 entries classified (45 current, 8 no new records, 5 unavailable, 13 ingestion failed). Real data showed relevance-filter empties being counted as failures; fixed, with every adapter message under test | **Yes**: production states 46 current, 11 no new records, 5 unavailable, 9 ingestion failed. The same failing sources as on the preview |
| Phase 2: source registry with per-source timing | #166 | Yes | **Yes**: the slowest group (faith/community pages) takes ~17 s and sets the ingest's build time | **Yes**: the faith/community page group sets the build time (16–27 s) |
| Phase 4 frontend build | — | No | — | — |

### Preview finding: sources currently failing (14 Oct 2026)

The first ingest on the #166 preview reported these real problems, previously hidden as unavailable or empty:

- **Ingestion failed:**
  - YouTube feeds returning 404: `cap-the-towers`, `eci-ealing`, `eci-southall`, `southall`, `young-ealing-foundation`.
  - Pages whose dated-link pattern no longer matches: `ealing-libdems-news`, `lager-can-blog`, `norwood-green-residents`, `southall-community-alliance`.
- **Unavailable:** `ealing-community-independents-current` (403), `ealing-synagogue-civic` (403), `ealing-culture` (HTML instead of JSON), `hanwell-community-forum` (fetch failed), `neighbours-paper` (timed out).

Each needs a source-specific fix or retirement. That is content maintenance, outside this plan.

A Blobs `400` from listing contributions (`Reviewed civic context activity unavailable`) appears only on deploy previews and deploy permalinks, including deploys from before this work. It is caught, and it does not occur on production.

### Source fixes (14 Oct 2026)

These follow from the failing-source list above. Each cause was diagnosed from the live pages, and fixtures trimmed from those pages back `scripts/test-source-adapters.mjs`.

| Source | Cause | Fix |
|--------|-------|-----|
| 5 YouTube channels (Cap the Towers, ECI Ealing, ECI Southall, Southall, Young Ealing Foundation) | `videos.xml?user=<handle>` only works for legacy usernames, and these are @handles (404) | Sources name a `youtubeHandle`. The ingest resolves it to a channel ID from the channel page, caches it in Blobs for 30 days, and keeps using a cached ID if the page is briefly unreachable |
| LAGER Can | Permalinks changed from `/YYYY/MM/DD/slug/` to `/slug/` | New pattern, with the listing scoped to `posts-wrapper` … `</main>` so menu pages are excluded; posts are dated from `<time datetime>` |
| Ealing Lib Dems | Articles have no `<article>`/`<main>` and no date metadata, so every one was dropped as undated | Per-source `articleDateClass: 'text-aux'`: the date is the only element with that class, directly under the headline |
| Southall Community Alliance | Articles carry no date of their own | Switched to its WordPress RSS feed, keeping the existing item ID scheme so archived items are not duplicated |
| Norwood Green Residents' Association | Homepage no longer links any news; the feed's only post is from 2021 | Retired |
| Neighbours' Paper | RSS fetch timed out at 7.5 s | RSS timeout raised to 12 s, matching the other adapters (fetching now happens in the background ingest) |
| Ealing Community Independents, Ealing Synagogue | 403 to our crawler user-agent | Left as `unavailable`. We do not disguise the crawler; ask the publishers to allow it, or retire the sources |
| Ealing Culture | HTML returned where JSON was expected (likely a firewall page) | Left as `unavailable`; needs the publisher's API access or a different endpoint |
| Hanwell Community Forum | Site unreachable, including from a third-party fetcher | Left as `unavailable`; retire if it stays down |

**Verified on preview (#167, 14 Oct 2026):** after one ingest, all eight targeted sources are `current`: the five YouTube channels (7–15 items each), LAGER Can (10), Ealing Lib Dems (6) and Southall Community Alliance (2). Norwood Green no longer appears. States went from 45 current / 9 ingestion failed to 53 current / 12 no new records / 4 unavailable / 1 ingestion failed. Still open:
- Neighbours' Paper times out even at 12 s.
- **New:** Ealing Green Party (`/news/` returns 404, and the homepage HTML now has no links, which suggests a rebuilt or script-rendered site). This is follow-up work, surfaced by the source states as intended.

### Production finding: the archiver runs two or three times per slot (pre-existing)

The production logs show each 15-minute `item-archive` slot invoked 2–3 times within about a minute, e.g. 10:15:27, 10:16:00 and 10:16:21. Each invocation returns 499 at about 15 s while the function keeps running for 15–25 s, which is consistent with the scheduler timing out and retrying. This happened before #165 as well (09:15:15, 09:15:35, 09:16:05).

- **Effect:** every slot repeats the whole upstream fan-out and deep fetch two or three times, multiplying load on outside sites and function time. Runs also overlap.
- **Index safety:** overlapping runs are exactly the case the index's conditional writes and newer-revision guard handle, and production confirms it: the overlapping runs at 10:15–10:16 left a complete, correct index.
- **Fix (Phase 2):** make ingestion a background function, or split it so the scheduled entry point returns well within the limit, and add a run lock in Blobs so duplicate invocations exit early.

### Preview measurements (14 Oct 2026, real Netlify Blobs, 2,260 items)

| Measure | Production (`main`) | Preview (#165) |
|---------|---------------------|----------------|
| `civic-archive?limit=40` median, cache-busted (7 samples) | 2,810 ms | 382 ms |
| `civic-archive?limit=40&offset=40` median | 2,437 ms | 367 ms |
| `civic-archive?limit=40&q=council` median | 2,597 ms | 394 ms |
| In-function page read, median of 13 cases (same data, same deploy) | full scan ≈2,300 ms | index ≈135 ms |
| `historical-reporting?term=southall` median | 171 ms | 178 ms (unchanged; it already used an index) |
| `combined-feed` (cache-busted) | 8–32 s, highly variable | 8–31 s, same range when interleaved with production |

- **Index size:** 2.0 MB for 2,260 items (≈890 bytes per item). Readers load it whole and still answer in under 0.4 s, but at the current growth it passes 4 MB around 5,000 items. Shard it by year or source, or move it to Postgres, before then.
- **`combined-feed` is the next bottleneck.** It takes 8–32 s on both production and preview, with several samples near 31 s that look like an upstream timeout. The time is the live fan-out to outside sources, which this PR doesn't change. That is Phase 2's job, and it now has a measured baseline.

### Local measurements (relative only)

`scripts/test-archive-index-blobs.mjs` with the real Blobs client against its local server, 3,000 items:

| Measure | Full scan | Indexed |
|---------|-----------|---------|
| Store reads per archive page (40 items) | 3,001 | 41 (constant) |
| Median page time | 1,529 ms | 34 ms |
| Full pagination walk (30 pages) | — | 2.1 s, 0 duplicates, 0 missing, newest-first |

Reconciliation cost (the scheduled check of stored-item fingerprints):

- **Steady state:** 2 listings, 2 index reads and 0 writes (no manifest or index rewrite when nothing changed). The only size-dependent part is the `item/` listing (one request per 1,000 keys). The archiver already listed every key on every run before this PR, so the scheduled function takes on no new O(N) reads. Locally: 74 ms at 600 items, 430 ms at 3,000, almost all of it listing.
- **Backfill:** one read per stale item, capped at 2,000 per run (≈0.5 s per 250 locally). It runs once after deploy, then only for changed items.
- **Growth to watch:** the index blob is read whole by readers and by the archiver. Its size is logged (`searchIndexBytes`). Shard it or move to Postgres before it reaches a few MB.

These are local-server numbers; network latency to real Blobs will be higher for both paths. The preview run supplies the real ones.

### How to verify on a deploy preview

Scheduled functions don't run on deploy previews, and preview Blobs reads use a deploy-scoped store that starts empty. `netlify/functions/archive-index-check.mjs` handles both. It refuses to run in production and requires an `ARCHIVE_CHECK_TOKEN` env var (set it for the deploy-preview context only). It copies production items into the preview's own store (production is only read, through a wrapper with no write methods), runs reconciliation passes on demand, and compares indexed and full-scan results. Run:

```
PREVIEW_URL=https://deploy-preview-165--ealing-civic-commons.netlify.app \
BASELINE_URL=https://ealing.civiccommons.co.uk \
ARCHIVE_CHECK_TOKEN=... npm run check:archive-index-preview
```

It writes `archive-index-preview-report.json` with seeding, reconciliation passes and steady-state cost, each comparison case, the pagination walk, endpoint headers and timings against the baseline (cache-busted), and error-response headers. It exits non-zero on any failure.

## 1. Current shape (as built)

- **Static site** (`public/` → `dist/`): ~39 hand-written browser modules (~324 KB unminified), no bundler, manual `?v=` cache-busting, many assets forced to `max-age=0, must-revalidate`.
- **~55 Netlify Functions**, all request-time. The core is `combined-feed-core.mjs`, which on every cache miss fans out to **18 upstream fetchers + 12 strong-consistency Blob reads** (`reviewedContextActivity`), then `combined-feed.mjs` adds a full archive scan.
- **Netlify Blobs** as the only datastore: archive (`civic-commons-items`), evidence generations, review queue, contributions, email subscriptions.
- **Scheduled functions**: `item-archive` (every 15 min — itself calls the full combined feed plus deep fetchers), `email-dispatch` (every 15 min), `evidence-refresh` (daily), WDTK publish (6-hourly).
- **Edge functions**: `social-preview` runs on `/`, `/items/*` and entity routes and makes a second hop to the `social-page` function for every navigation.
- **Off-platform**: DigitalOcean ModernGov relay (static egress) and Commons Chat server.
- **GitHub Actions** commit refreshed planning JSON into `public/data/`.

## 2. Hot spots (ranked by impact)

| # | Problem | Where | Effect |
|---|---------|-------|--------|
| 1 | **Full archive scan per request.** `listArchivedItems` does `list('item/')` then GETs *every* item blob (strong consistency, batches of 100) before filtering/paginating. | `netlify/lib/civic-items.mjs` (`authoritativeArchiveRecords`), called by `combined-feed`, `place-current-records` (limit 250), `civic-archive` | Latency and Blob ops grow linearly with archive size, on the homepage's critical path. `archiveItems` also lists every key on each 15‑min run. This is the main thing that will stop scaling. |
| 2 | **Live fan-out on the read path.** Each feed cache miss hits ~18 third-party sites. | `combined-feed-core.mjs` | Response time = slowest upstream (risking the 10 s sync-function limit); load on small community sites; one CDN miss per edge node per 5 min. |
| 3 | **Personal feed & email recompute everything.** `personal-feed` calls the combined-feed handler in-process; its URL varies per follow set so the CDN rarely hits. `email-dispatch` calls `personal-feed` over HTTP **sequentially per subscriber**. | `personal-feed.mjs`, `email-dispatch.mjs`, `lib/email-alerts.mjs` | Cost = subscribers × (18 upstream fetches + archive scan) every 15 min. Will hit function timeouts and upstream rate limits at a few dozen subscribers. |
| 4 | **Duplicate work in the scheduler.** `item-archive` recomputes the same feed the readers compute, but doesn't publish it for them. | `item-archive.mjs` | Work is done twice; readers don't benefit. |
| 5 | **Edge double-hop on every page view.** `social-preview` fetches `social-page` for `/`, items and entities without edge caching. | `edge-functions/social-preview.js` | Extra function invocation + latency on every navigation. |
| 6 | **Frontend delivery.** Many separate unminified modules per page (entity page: 11 + dynamic imports); revalidation forced on core JS/CSS; SW is network-first for everything; feed fetched with `cache: 'no-store'` (which also sends `Cache-Control: no-cache` upstream). | `public/*.html`, `_headers`, `sw.js`, `app.js` | Slow first paint on mobile, many round-trips, no effective repeat-visit caching. |
| 7 | **Maintainability debt that blocks optimisation.** Minified one-line library code (`civic-items.mjs`); `coveragePreservingSlice`/`stableItemKey` duplicated; 18 hand-written fallback blocks; competing client renderers (see render audit). | various | Hard to change safely; easy to regress. |

## 3. Target architecture: "ingest → snapshot → serve"

Move all third-party fetching and heavy joins off the request path. Readers only read precomputed blobs.

```
scheduled ingest (item-archive, every 15 min, background fn)
   ├─ fetch sources (per-source TTL, timeout, circuit breaker)
   ├─ write archive items (only changed)
   ├─ write indexes: index/by-source/<id>, index/by-town/<t>, index/by-topic/<t>, index/recent
   └─ write snapshot: snapshot/combined-feed.json  (+ snapshot/health.json)

request path
   combined-feed       → 1 blob read (snapshot)            → CDN cached
   personal-feed       → snapshot + filter in memory       → CDN cached by normalised query
   civic-archive /
   place-current-records → index blob(s) + page of item reads
   email-dispatch      → load snapshot once, filter per subscriber in-process
```

## 4. Phased plan

### Implementation notes (PR #165; see the ledger for verification state)
- Archiver reads/writes use strong consistency (it compares a listing with fresh writes). `store()` now passes options to deploy stores too.
- Etags are taken from a listing made before the read when a backend omits them on reads. The local Blobs server does; the real-client test caught this.
- `civic-items.mjs`: `manifest/search-index` is now a complete v2 metadata index. Each entry records the etag of the item blob it was built from. Writes are conditional (etag) and never replace a newer revision of an item with an older one. The 15‑minute archiver compares entries with a fresh listing: missing, outdated or etag-mismatched entries are reloaded (≤2000 per run), entries whose blob is confirmed gone are pruned, and the index is marked `complete` only when every listed blob has a current entry. `listArchivedItems` uses the index only when complete and loads just the requested page; a read error is retried once and then rejects (the API returns 503), and a blob missing behind an index entry makes that request use the full scan rather than return a short page. `historical-reporting` benefits automatically. `scripts/test-civic-items.mjs` covers partial backfills, out-of-band changes, concurrent upserts, write conflicts, deletions, read failures and interrupted runs.
- Index size grows with the archive (one metadata entry per item). Watch `searchIndexSize` in the `item-archive` log; shard by source/year or move to Postgres if the index passes a few MB.
- `archiveItems` no longer treats a failed `list()` as an empty archive (previously that would have rewritten every item).
- `email-dispatch` builds the combined feed and contributions once per run and renders each subscriber's feed in-process via `renderPersonalFeed`.
- `netlify-cdn-cache-control: public, durable, …` mirrors every public function `cache-control`; error responses from shared JSON helpers are `no-store`.
- `social-preview` edge function uses `cache: 'manual'`.
- Feed/entity/issue list fetches in the browser no longer use `cache: 'no-store'`.
- Reviewed-context lookups in the combined feed use eventual consistency.

### Phase 1 — quick wins (low risk, days)
1. **CDN caching done properly.** Add `Netlify-CDN-Cache-Control: public, durable, s-maxage=300, stale-while-revalidate=900` to read endpoints (feeds, archive, social-page, entity/issue/topic APIs) so one origin computation is shared across edge nodes. Add `Netlify-Vary: query=…` with only the meaningful params.
2. **Drop `cache: 'no-store'`** from feed/contribution fetches in `app.js` (use default or `no-cache`); rely on short server TTLs.
3. **Edge caching for `social-preview`**: return the `social-page` response with its cache headers intact and set `cache: 'manual'` in the edge config, or skip the hop for `/` (homepage meta is static).
4. **Email dispatch**: build the combined feed **once** per run and filter per subscriber in-process (extract `personal-feed`'s filtering into `lib/`); process subscribers with bounded concurrency (e.g. 5).
5. **Batch `reviewedContextActivity`**: default (eventual) consistency is fine here; it runs on every feed miss.

### Phase 2 — snapshot serving (implemented in the Phase 2 PR)
- **Ingest:** the scheduled `item-archive` function only POSTs to `feed-ingest` (a background function, 15-minute limit) and returns. `feed-ingest` takes a Blobs lock (15-minute expiry) and enforces a 5-minute minimum interval. Its URL is public, so this also bounds how often anyone can make it run. It then builds the feed live once, applies source states, writes `snapshot/combined-feed` and `sources/state` to the `civic-commons-feed` store, and archives from the same build (`runArchive`). The upstream fan-out runs once per slot instead of 2–3 times, plus once per CDN miss.
- **Serve:** `combined-feed` returns the snapshot while it is under 60 minutes old, with `snapshot.servedFrom` and `ageSeconds`. Otherwise it builds live and says why (`snapshot.reason`). `personal-feed`, `place-current-records`, `civic-item` and `email-dispatch` all go through it.
- **A failed source never looks like an absent one.** Every health entry has a `state`:
  - `current`: fetched, with records.
  - `no-new-records`: fetched fine, nothing to show.
  - `unavailable`: network, timeout, 403/408/429/5xx or upstream errors.
  - `ingestion-failed`: reached, but the response could not be used, e.g. a 404 or a parse failure.
  - Failing sources keep their last good items (up to 20), marked `stale` with `staleSince`. Health records `failingSince`, `lastSuccessAt` and `consecutiveFailures`. The homepage health panel and timeline show all of this.
- **Registry:** `SOURCES` in `combined-feed-core.mjs` replaces the 18 hand-written fetch/fallback blocks; each health entry records `durationMs`, and the ingest log lists the five slowest sources. A failure of the local RSS handler now degrades to an error health entry instead of failing the whole feed.
- **Verify on preview:** POST `/.netlify/functions/feed-ingest` (scheduled functions do not run on previews), then check that `combined-feed` reports `snapshot.servedFrom: "snapshot"` and its response time.
- **Later:** per-source TTLs (refresh slow-moving sources less often) and conditional requests (`If-None-Match`/`If-Modified-Since`).

### Phase 3 — archive indexing (~1 week, before archive passes a few thousand items)
1. Maintain **index blobs** at write time in `archiveItems`: `index/recent` (key, publishedAt, sourceId, towns, topics, title), plus per-source/town/topic shards. The existing `manifest/recent` and `manifest/search-index` are a start — make them the read path.
2. `listArchivedItems` reads the relevant index, filters/sorts metadata in memory, then GETs **only the page** of item blobs (≤100).
3. Text search (`q`) runs over the index's title/summary fields; if it outgrows that, move archive + search to a hosted Postgres (e.g. Supabase/Neon with `tsvector`) — Blobs isn't a query engine.
4. Stop listing all `item/` keys inside `archiveItems`; check existence via the index.
5. Use strong consistency only where read-after-write matters (review/moderation), eventual elsewhere.

### Phase 4 — frontend delivery (~1 week, aligns with render audit)
1. Add an **esbuild step** to `npm run build`: one entry per page (`index`, `entity`, `issue`, `topic`, `explore`, …), minified, content-hashed filenames, code-split shared modules. Rewrite `<script>` tags at build time; remove manual `?v=` strings.
2. `_headers`: hashed assets `Cache-Control: public, max-age=31536000, immutable`; HTML stays revalidating.
3. Service worker: cache-first for hashed assets, stale-while-revalidate for feed JSON (offline reading of the last feed), versioned cache name from the build.
4. Follow the render audit: one page controller per route; remove the `context-reporting.js` competing renderer and persistent `MutationObserver`s.
5. Lazy-load below-the-fold modules (election history, evidence graphics, share) with `IntersectionObserver`/dynamic import.

### Phase 5 — other improvements
- **Observability**: per-source latency/status/item count and snapshot age written to `snapshot/health.json`; alert (GitHub Action or scheduled fn → email) when snapshot age > 1 h or a source fails for > 24 h.
- **Testing/CI**: run the existing `test:*` scripts on PRs (not just in the Netlify build); add a test for `listArchivedItems` paging against an in-memory blob stub; add a Lighthouse CI budget for the homepage and an entity page.
- **Code health**: de-minify `civic-items.mjs`; deduplicate `coveragePreservingSlice`, `stableItemKey`, `canonical`; consolidate `entity.html`/`civic-entity.html`.
- **Repo hygiene**: remove `.b64` image copies under `public/brand/towns/` from the deployed output; consider moving refreshed planning JSON to Blobs (written by the Action or a scheduled fn) to avoid weekly data commits and redeploys.
- **Politeness/resilience**: shared `fetch` helper with a descriptive User-Agent, `If-None-Match`/`If-Modified-Since` conditional requests (store ETags per source) to cut upstream bandwidth.
- **Multi-borough scaling** (`START-A-CIVIC-COMMONS.md`): namespace Blob stores and snapshots by commons ID now (`<commons>/snapshot/...`) so a second borough doesn't need a code fork.

## 5. Suggested order & success measures

| Order | Item | Measure |
|-------|------|---------|
| 1 | Phase 1 | CDN hit ratio on `combined-feed` > 90%; email run time independent of subscriber count |
| 2 | Phase 3.1–3.2 (index read path) | `civic-archive` p95 < 300 ms regardless of archive size |
| 3 | Phase 2 | `combined-feed` origin p95 < 200 ms; zero upstream fetches on read path |
| 4 | Phase 4 | Homepage LCP < 2.5 s on mid-range mobile; JS requests per page ≤ 3 |
| 5 | Phase 5 | Snapshot-age alert in place; PR CI runs tests |

Phase 3 is ordered before Phase 2 because the archive scan is on the homepage's path today (`combined-feed.mjs` → `listArchivedItems`) and its cost grows every 15 minutes.
