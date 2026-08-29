# Persistent civic item store

**Status:** Working prototype  
**Date:** 29 August 2026

The Civic Commons live timeline is assembled from upstream RSS/Atom feeds. RSS windows are temporary: an item can disappear from a publisher's feed even though the Commons permalink, follows, contributions and relationships attached to that item should remain useful.

This layer gives normalized Civic Commons items durable storage without replacing the original publisher as canonical source.

## Storage model

The first implementation uses the existing `@netlify/blobs` dependency and a site-wide store named:

```text
civic-commons-items
```

Each item is stored under:

```text
item/{stableItemKey}
```

`stableItemKey` is the same UTF-8 base64url key already used by `/items/{key}`, `civic-item:{key}` thread IDs, follows and personal RSS. No existing public identifier changes.

The archived record contains the normalized item fields needed to reconstruct the Civic Commons item page: source/provenance, title, canonical/original URL, summary, publication date, towns, topics and any official category enrichment.

It does not copy full publisher articles.

## Archiving

`item-archive.mjs` runs every 15 minutes. It invokes the normal feed pipeline and archives the resulting normalized items.

A small `manifest/recent` record remembers recently archived keys. This avoids issuing writes for the same live feed window on every scheduled run. Individual item writes also use Netlify Blobs' `onlyIfNew` guard, so the store remains append-like even if a key falls out of the manifest later.

The manifest is an efficiency aid, not the authoritative archive. Individual `item/{key}` records are.

## Reading

`civic-item.mjs` exposes a read-only JSON lookup by stable key.

The browser item page continues to prefer the current live feed, because that contains the freshest normalized/enriched representation. If the item is no longer live, it falls back to the persistent archive. The contribution thread and follow identity are therefore unchanged as the source item ages out of RSS.

## Personal RSS

Directly followed stories also fall back to persistent storage when they leave the live feed window. This preserves the source-item entry and title context for later approved contributions.

Broader source/place/topic follows still use the live ingestion window for discovery in this iteration. A future historical index can add archive queries by source, place and topic without changing the public follow model.

## Provenance and retention

The stored object is a Civic Commons normalization snapshot, not a claim of ownership over the source content. The original URL remains prominent and canonical.

Records are not currently expired automatically. Deletion/correction tooling should be added before treating the archive as a permanent statutory or evidential record. Publisher removals, legal requests and material normalization corrections need an explicit audit-safe policy rather than silent mutation.

## Next layer

Persistent item identity makes later relationship storage practical:

- item → official meeting/document;
- item → reporting;
- item → evidence;
- item → person/organisation/place;
- item → approved community contribution;
- item → correction or successor item.

Those relationships can reference the stable item key even after the source RSS entry has disappeared.
