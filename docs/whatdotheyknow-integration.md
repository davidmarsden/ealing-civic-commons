# WhatDoTheyKnow — Ealing Council

**Status:** INGESTING  
**Geography:** Borough-wide  
**Type:** Public FOI/EIR request platform / civic evidence  
**Canonical source:** WhatDoTheyKnow authority page for Ealing Council

Civic Commons acquires the bounded recent Ealing Council authority Atom feed through the controlled static-egress relay, normalises each request into a mutable Civic Commons item, and persists it in the Civic Archive. The scheduled publisher runs every six hours at minute 17.

Recent persisted requests are also projected into the main **Latest** feed. They retain WhatDoTheyKnow as the publisher/canonical request URL; Civic Commons does not republish correspondence as its own material.

The live source-health list exposes `whatdotheyknow-ealing`, so the source remains visible even when the archive currently contains no matching records. The read-only `whatdotheyknow-status` function exposes the last scheduled production run, including discovered/normalised counts, persistence counts and failures. This separates acquisition, scheduler and persistence failures during diagnosis.

Current limitation: Atom provides the recent request window but not full correspondence threads or attachment metadata. Historical backfill and richer thread ingestion remain separate work.

## Relay links and request states (26 Nov 2026)

- The relay returns WDTK's Atom feed with its own host (`chat-dev.ealing.civiccommons.co.uk`) in every link. The parser rewrites `/request`, `/request_event`, `/body` and `/user` links back to `www.whatdotheyknow.com`.
- Each listing icon has two classes (`icon-standalone icon_<state>`). Status is now the Alaveteli state code from the second class (e.g. `partially_successful`), not `standalone`.
- Each scheduled run also repairs archived WDTK items that still have relay links or no state. The state is recovered from the stored summary text. The repair is idempotent; its counts appear in the status function's `lastRun.repair`.
- `whatdotheyknow-status` now includes `authorityStats`, a dated snapshot of WDTK's authority totals (`public/data/whatdotheyknow-ealing-stats.json`). It is a manual snapshot: WDTK's Cloudflare challenge blocks Netlify, and the relay serves only the feed.
- Known limitation: the feed is per event, so one request can appear as several items (231 items for about 50 requests as of 26 Nov 2026). Grouping events into requests needs the request slug, which the feed doesn't carry.
