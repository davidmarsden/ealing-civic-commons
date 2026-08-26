# Civic Commons follow model

**Status:** Social Phase B1  
**Date:** 27 August 2026

The first Civic Commons follow implementation is deliberately account-free. Follow choices are stored in the visitor's browser under the versioned local-storage key:

`civic-commons:follows:v1`

## Follow targets

Four stable target types are supported:

- `items` — the deterministic base64url item key already used by `/items/{key}` and `civic-item:{key}`;
- `sources` — the ingestion source ID such as `southall-stories`;
- `towns` — the canonical place label used by the Commons taxonomy;
- `topics` — the canonical topic label used by the Commons taxonomy.

Each stored target is an object containing an `id` and human-readable `label`. The label is presentation data; matching uses the stable `id`.

Example:

```json
{
  "version": 1,
  "items": [
    { "id": "STABLE_ITEM_KEY", "label": "Example civic story" }
  ],
  "sources": [
    { "id": "southall-stories", "label": "Southall Stories" }
  ],
  "towns": [
    { "id": "Southall", "label": "Southall" }
  ],
  "topics": [
    { "id": "Housing", "label": "Housing" }
  ]
}
```

## Matching semantics

The Following timeline uses **OR semantics**. An item appears when it matches at least one followed target:

- the exact item;
- its source;
- any of its towns;
- any of its topics.

Normal place/topic/source-type filters can then narrow that personal timeline.

The Following view starts borough-wide so the homepage's default Southall filter cannot accidentally hide an explicitly followed Ealing, Acton, Greenford, Hanwell, Northolt or Perivale item.

## Privacy and portability

No follow choice is sent to the server in B1. No account, email address or tracking identifier is required. Clearing browser storage removes the follows.

The stable target identifiers are intentionally independent of this storage implementation. A later account system, personal RSS feed or email subscription service should reuse the same target IDs and matching semantics.

## Next step

Social Phase B2 can turn a set of follow targets into an open RSS representation. The browser-local state can remain useful as the anonymous zero-account version even after server-side subscriptions exist.
