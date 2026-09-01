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

Evidence refreshes are published as immutable generation-scoped records rather than by overwriting live keys one at a time:

```text
generation/{generation}/object/{stable-key}
generation/{generation}/collection/{stable-key}
generation/{generation}/manifest/place/southall
generation/{generation}/manifest/place/ealing
generation/{generation}/snapshot/southall
```

Readers follow one active pointer:

```text
active/southall
```

A refresh stages its complete generation first. Only after every record, manifest and snapshot write succeeds is `active/southall` switched to the new generation. A failed refresh therefore leaves readers on the complete previous generation rather than exposing a hybrid of old and new evidence.

## Revisions

A semantic SHA-256 hash is calculated from the evidence content. Retrieval/storage timestamps are excluded from that hash. Source observations are also canonicalized into stable geographic order before normalization so an ArcGIS row-order change cannot create a false revision.

Therefore:

- fetching the same published value again updates `lastSeenAt` but does not create a new revision;
- a substantive change to the normalized evidence increments `revision`;
- the previous active record is archived before a changed generation may become active;
- an archive failure aborts publication, preserving the previous active generation for retry.

History keys use:

```text
history/{object|collection}/{stable-key}/{revision}-{semantic-hash}
```

Each active record exposes:

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

The scheduled refresh is stricter: a stale fallback or persistence failure is rethrown after logging so Netlify records the scheduled invocation as failed rather than reporting a missed refresh as successful.

## Public APIs

```text
/api/evidence/southall
/api/evidence/place?place=southall
/api/evidence/place?place=ealing
/api/evidence/record?kind=collection&id={stable-id}
/api/evidence/record?kind=object&id={stable-id}
```

The record endpoint is the stable inspection route for one normalized evidence object or collection. Place and record readers resolve through the same active generation pointer.

## First page integration

`/places/southall` consumes the place API and presents a deliberately small set of graphical evidence:

- IMD 2025 score;
- household overcrowding;
- child low-income rate at ward geography.

Other valid evidence can remain in the store/API without deserving graphical prominence. In particular, IMD decile and borough-level homelessness are retained but not promoted as charts; the current Ealing Data air-quality group remains excluded from production normalization.

## Next expansion

After this persistence layer is proven, evidence relationships can be attached to more place, topic and civic-item pages. Expansion should remain curated: technical availability in the Ealing catalogue is not sufficient reason to publish an indicator as Civic Commons evidence.
