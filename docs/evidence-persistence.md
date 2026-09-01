# Civic Commons evidence persistence

**Status:** Phase 4 implementation  
**Date:** 1 September 2026

PR #42 turns the normalized evidence model introduced in PR #40 into a persistent Civic Commons layer.

## Store

Production uses the global Netlify Blobs store:

```text
civic-commons-evidence
```

Deploy previews use a deploy-scoped store instead, so testing cannot write evidence into the production store.

Current records use deterministic source-derived IDs encoded as blob-safe keys:

```text
current/object/{stable-key}
current/collection/{stable-key}
```

Place manifests make the current collections discoverable without scanning the store:

```text
manifest/place/southall
manifest/place/ealing
```

The latest normalized Southall payload is also retained as a source snapshot:

```text
snapshot/southall
```

## Revisions

A semantic SHA-256 hash is calculated from the evidence content. Retrieval/storage timestamps are excluded from that hash.

Therefore:

- fetching the same published value again updates `lastSeenAt` but does not create a new revision;
- a substantive change to the normalized evidence increments `revision`;
- the previous current record is copied to an immutable-style history key before the new current record replaces it.

History keys use:

```text
history/{object|collection}/{stable-key}/{revision}-{semantic-hash}
```

Each current record exposes:

- `revision`
- `semanticHash`
- `firstSeenAt`
- `lastSeenAt`
- `changedAt`

## Refresh

Evidence is refreshed in two ways:

1. the public evidence service refreshes when the persisted Southall snapshot is older than 24 hours;
2. `evidence-refresh.mjs` runs once daily at 03:17 UTC on published production deploys.

If the upstream Ealing service fails, the public endpoint may serve the last persisted snapshot rather than replacing evidence with an error. If persistence itself is unavailable during a successful live fetch, the normalized live response can still be served without claiming it was persisted.

## Public APIs

```text
/api/evidence/southall
/api/evidence/place?place=southall
/api/evidence/place?place=ealing
/api/evidence/record?kind=collection&id={stable-id}
/api/evidence/record?kind=object&id={stable-id}
```

The record endpoint is the stable inspection route for one normalized evidence object or collection.

## First page integration

`/places/southall` consumes the place API and presents a deliberately small set of graphical evidence:

- IMD 2025 score;
- household overcrowding;
- child low-income rate at ward geography.

Other valid evidence can remain in the store/API without deserving graphical prominence. In particular, IMD decile and borough-level homelessness are retained but not promoted as charts; the current Ealing Data air-quality group remains excluded from production normalization.

## Next expansion

After this persistence layer is proven, evidence relationships can be attached to more place, topic and civic-item pages. Expansion should remain curated: technical availability in the Ealing catalogue is not sufficient reason to publish an indicator as Civic Commons evidence.
