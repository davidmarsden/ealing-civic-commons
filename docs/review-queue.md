# Civic Commons review queue

**Status:** Phase 7A prototype  
**Date:** 31 August 2026

Phase 7A replaces scattered/manual moderation inputs with one durable private queue while keeping publication separate from review.

## What enters the queue

The first implementation supports four review kinds:

- `item-contribution` — corrections, evidence, related sources, local information and context submitted from stable item pages;
- `source-submission` — public suggestions from the Submit a source form;
- `evidence-suggestion` — candidate public evidence discovered by an editor or importer;
- `relationship-suggestion` — future candidate graph relationships.

Netlify form submissions are mirrored into the queue by `submission-created.mjs`. The original form workflow remains intact during this phase.

## Storage and privacy

Queue records live in the site-wide Netlify Blobs store `civic-commons-review-queue`.

Each record has:

- stable review ID;
- kind and source;
- `pending`, `needs-info`, `accepted` or `rejected` status;
- public-candidate payload;
- separate private moderation fields;
- provenance;
- review decision details and history.

Private submitter data such as email addresses is never copied into the public contribution registry automatically. Phase 7A does not publish anything from the queue.

Every decision is also written as a separate immutable audit blob as well as being reflected in the record history.

## Reviewer interface

`/review.html` is a no-index reviewer shell. Queue data is only returned after the reviewer supplies the bearer token configured in the Netlify environment as:

`REVIEW_ADMIN_TOKEN`

The token is held in browser `sessionStorage`, not embedded in the deployed JavaScript bundle. The reviewer label is stored locally and attached to decisions.

## Public Notice Portal test importer

The reviewer interface includes a manual **Import current Ealing public notices** action.

It checks the current Ealing Planning, Traffic & Roads, Alcohol & Licensing and Statutory index pages at `https://publicnoticeportal.uk/`, extracts canonical notice URLs, and queues a bounded set of current notices as `evidence-suggestion` records.

Only discovery metadata is stored: title, canonical URL, notice type, broad Ealing scope, topic hint and publication date when detectable. Civic Commons does not copy the full notice text, and nothing enters the public timeline or graph without a later review/promotion step.

The Public Notice Portal remains canonical. It is operated by the News Media Association and receives public-notice data from local news publishers.

## Phase boundary

Phase 7A deliberately stops at **review state**.

Accepting a queue item means “reviewed and potentially suitable for promotion”; it does **not** yet automatically publish a contribution, add a source or assert a graph relationship.

Phase 7B can add type-specific promotion handlers while preserving the same stable review IDs and audit history.
