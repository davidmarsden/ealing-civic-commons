# Civic Commons contribution moderation workflow

**Status:** Social Phase A2 working process  
**Date:** 27 August 2026

The Civic Commons accepts item-level contributions through the Netlify `item-contribution` form. Those submissions are **private moderation inputs**, not automatically public comments.

Approved contributions are published from the version-controlled registry at:

`public/data/contributions.json`

This creates a deliberate boundary between submission and publication. A contribution only becomes part of the public civic record after a human moderation decision and a reviewed repository change.

## Privacy boundary

The public registry must never contain submitter email addresses or other private moderation-only fields.

Publish only information the contributor has agreed may be made public:

- contribution ID;
- stable Civic Commons thread ID;
- contribution type;
- contribution body;
- optional related public URL;
- optional display name;
- submitted date where useful;
- publication date;
- public provenance note;
- `status: published`.

## Public contribution schema

```json
{
  "id": "cc-2026-0001",
  "threadId": "civic-item:STABLE_ITEM_KEY",
  "type": "Evidence / document",
  "body": "The supporting planning document was published separately and adds useful context.",
  "relatedUrl": "https://example.org/public-document",
  "displayName": "Local resident",
  "submittedAt": "2026-08-27T08:30:00Z",
  "publishedAt": "2026-08-27T10:00:00Z",
  "provenance": "Submitted to Civic Commons; link checked and contribution reviewed before publication.",
  "status": "published"
}
```

Allowed contribution types currently match the submission form:

- `Correction`
- `Related source`
- `Evidence / document`
- `Local information`
- `Comment / context`

## Moderation sequence

1. Review the submission in Netlify Forms.
2. Check that it is attached to the intended `thread-id` and Commons item.
3. Check any related URL and verify that it is safe and relevant.
4. Decide whether the contribution should be published, rejected, or held for clarification.
5. If publishing, copy only the approved public fields into `public/data/contributions.json`.
6. Assign a stable contribution ID and set `status` to `published`.
7. Record an accurate provenance note rather than implying independent verification where none occurred.
8. Publish through the normal repository review/deploy process.

## Display behaviour

Item pages load the public registry and display only entries where:

- `status` is exactly `published`; and
- `threadId` exactly matches the item's stable Civic Commons thread ID.

Published entries are grouped by contribution type. Within each group they are chronological rather than popularity-ranked.

The interface exposes publication date, public attribution, a moderation label and provenance. Related URLs are only rendered when they resolve to HTTP or HTTPS.

## Corrections

A published correction does not silently alter the original publisher's material. It appears as a clearly labelled Civic Commons contribution beside the original source, preserving the distinction between:

- what the original publisher published;
- what a contributor says should be corrected or contextualised; and
- what moderation action the Commons took.

If the original publisher later changes or corrects its own material, that can be recorded separately as provenance/history rather than rewriting the contribution record.

## Next step

This registry is intentionally simple and portable. A later datastore or moderation console can replace the JSON editing workflow while preserving the same contribution IDs, thread IDs and public representation.
