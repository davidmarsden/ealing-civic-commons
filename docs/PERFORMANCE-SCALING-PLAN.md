# Performance & scaling plan

Status: Phase 1 (except 3.x below) and Phase 3.1–3.2/3.4 implemented, 14 October 2026; later phases proposed. Complements `RENDER-ARCHITECTURE-AUDIT.md` (client rendering) and `technical-architecture-spec-v0.1.md`.

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

### Implementation notes (done)
- `civic-items.mjs`: `manifest/search-index` is now a complete v2 metadata index, updated with conditional (etag) writes by both `archiveItems` and `upsertMutableItems`. The 15‑minute archiver backfills missing/outdated entries (≤2000 per run) and marks the index `complete` once it covers every `item/` blob. `listArchivedItems` uses the index when complete and loads only the requested page; otherwise it falls back to the full scan. `historical-reporting` benefits automatically. Covered by `scripts/test-civic-items.mjs`.
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

### Phase 2 — snapshot serving (the main scaling fix, ~1–2 weeks)
1. Convert `item-archive` into a **background/scheduled ingest** that, after archiving, writes `snapshot/combined-feed.json` and `snapshot/health.json`.
2. `combined-feed` and `personal-feed` read the snapshot; fall back to live fan-out only if the snapshot is missing or older than ~1 h (and log it).
3. **Source registry**: replace the 18 hand-written `fetchX().catch(...)` blocks with a table (`id, name, homepage, fetcher, ttl, timeoutMs`). Gives one place for per-source TTLs (e.g. police 15 min, culture 6 h), timeouts, retry/backoff and a simple circuit breaker (skip a source for N runs after repeated failures, serving its last good items from blob).
4. Store **per-source last-good results** so a failing upstream degrades to stale data, not empty.

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
