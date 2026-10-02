# WhatDoTheyKnow — Ealing Council

**Status:** INGESTING  
**Geography:** Borough-wide  
**Type:** Public FOI/EIR request platform / civic evidence  
**Canonical source:** WhatDoTheyKnow authority page for Ealing Council

Civic Commons acquires the bounded recent Ealing Council authority Atom feed through the controlled static-egress relay, normalises each request into a mutable Civic Commons item, and persists it in the Civic Archive. The scheduled publisher runs every six hours at minute 17.

Recent persisted requests are also projected into the main **Latest** feed. They retain WhatDoTheyKnow as the publisher/canonical request URL; Civic Commons does not republish correspondence as its own material.

The live source-health list exposes `whatdotheyknow-ealing`, so the source remains visible even when the archive currently contains no matching records. The read-only `whatdotheyknow-status` function exposes the last scheduled production run, including discovered/normalised counts, persistence counts and failures. This separates acquisition, scheduler and persistence failures during diagnosis.

Current limitation: Atom provides the recent request window but not full correspondence threads or attachment metadata. Historical backfill and richer thread ingestion remain separate work.
