# Civic Commons contribution moderation workflow

**Status:** Phase 7B live workflow  
**Updated:** 1 September 2026

The Civic Commons accepts item-level contributions through the Netlify `item-contribution` form. Those submissions are **private moderation inputs**, not automatically public comments.

Approved item contributions are now published through the private Civic Commons review queue. The former manual `public/data/contributions.json` editing workflow is retired.

The boundary remains deliberate: a contribution becomes part of the public civic record only after a human moderation decision and successful publication reconciliation.

## Privacy boundary

Private review records may contain an email address, moderation context and reviewer notes. Those fields must never appear in the public contribution record or public submission-status page.

Publish only information the contributor has agreed may be public:

- stable contribution ID;
- stable Civic Commons thread ID;
- contribution type;
- contribution body;
- optional related public URL;
- optional display name;
- submitted date;
- publication date;
- public provenance note;
- `status: published`.

## Public contribution representation

The Phase 7B public store preserves the same portable representation established by the original JSON registry. A public record is conceptually:

```json
{
  "id": "contrib-REVIEW_ID",
  "reviewId": "rq-REVIEW_ID",
  "threadId": "civic-item:STABLE_ITEM_KEY",
  "type": "Evidence / document",
  "body": "The supporting planning document was published separately and adds useful context.",
  "relatedUrl": "https://example.org/public-document",
  "displayName": "Local resident",
  "submittedAt": "2026-09-01T20:30:00Z",
  "publishedAt": "2026-09-01T20:35:00Z",
  "provenance": "Submitted to Civic Commons and published after human review.",
  "status": "published"
}
```

Allowed contribution types match the public submission form:

- `Correction`
- `Related source`
- `Evidence / document`
- `Local information`
- `Comment / context`

## Current moderation sequence

1. Open the private `/review.html` queue and inspect the pending `item-contribution`.
2. Confirm the **canonical civic target** shown by the queue is the intended Commons story/thread.
3. Read the contribution and check any related HTTP/HTTPS URL for safety and relevance.
4. Decide whether it should be **Accept & publish**, **Needs info**, or **Reject**.
5. On **Accept & publish**, the server reconciles the authoritative review state with the public-contribution Blob store. The reviewer does not copy fields into a repository file.
6. Publication is considered successful only when the public record can be read back and the review card shows **Published ✓** with a public link.
7. If an accepted contribution is not verified as public, use **Retry publish** rather than creating a fake moderation decision.
8. If a published contribution is later moved to **Needs info** or **Rejected**, publication reconciliation withdraws the public record while retaining the private audit history.
9. Record reviewer notes accurately. Do not imply independent verification beyond what actually occurred.

## Contributor feedback

When a contributor supplies an email address:

- a receipt is sent after the verified form submission enters the review queue;
- meaningful moderation outcomes can generate email for publication, needs-info or rejection;
- a mail-provider failure does not roll back the moderation decision.

Every new public form submission also receives a high-entropy private status token. The contributor can bookmark `/submission-status.html?...` to see a public-safe state such as awaiting review, published after review, more information needed or not published.

Status pages never expose email addresses, reviewer identity or private moderation notes. The token is a bearer secret and the status page uses a `no-referrer` policy.

Notification claims currently suppress ordinary sequential retries. They are not an atomic concurrency lock, so two truly simultaneous deliveries could still race; do not describe the notification mechanism as exactly-once delivery.

## Display behaviour

Permanent item pages display only public contribution records where:

- `status` is exactly `published`; and
- `threadId` exactly matches the item's stable Civic Commons thread ID.

Published entries are grouped by contribution type and ordered chronologically rather than by popularity.

The interface exposes publication date, public attribution, a moderation label and provenance. Related URLs are rendered only when they are valid HTTP or HTTPS links.

Contribution activity may also resurface an older archived civic item in Latest as explicit Commons activity. This does not alter the original publisher, source URL or original publication date.

## Corrections

A published correction does not silently alter the original publisher's material. It appears as a clearly labelled Civic Commons contribution beside the original source, preserving the distinction between:

- what the original publisher published;
- what a contributor says should be corrected or contextualised; and
- what moderation action the Commons took.

If the original publisher later changes or corrects its own material, that can be recorded separately as provenance/history rather than rewriting the contribution record.

## Other review kinds

Phase 7B automatic publication currently applies only to `item-contribution` records.

`source-submission`, `evidence-suggestion` and `relationship-suggestion` records can be reviewed and accepted, but acceptance does **not** yet mean automatic public promotion. Phase 7C will add explicit promotion rules for those review kinds one at a time.

The constitutional rule remains: entering or being accepted in the private review queue is not, by itself, publication or a reviewed public assertion.
