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

Verified Netlify form submissions are mirrored into the queue by the `formSubmitted` event handler in `review-form-events.mjs`. Netlify signs and verifies platform-event invocations before the handler runs. The original form workflow remains intact during this phase.

## Storage and privacy

Production queue records live in the site-wide Netlify Blobs store `civic-commons-review-queue`. Deploy previews and branch deploys use a deploy-scoped store so test data cannot pollute the production moderation queue.

Each record has:

- stable review ID;
- kind and source;
- `pending`, `needs-info`, `accepted` or `rejected` status;
- public-candidate payload;
- separate private moderation fields;
- provenance;
- review decision details and history.

Private submitter data such as email addresses is never copied into the public contribution registry automatically. Phase 7A does not publish anything from the queue.

Every decision is also written as a separate audit blob as well as being reflected in the record history.

## Reviewer interface

`/review.html` is a no-index reviewer shell. Queue data is only returned after the reviewer supplies the bearer token configured in the Netlify environment as:

`REVIEW_ADMIN_TOKEN`

The token should be scoped to Netlify Functions/runtime and made available in both deploy-preview and production contexts so the private reviewer can be tested safely before merge and then used on the live site. The token is held in browser `sessionStorage`, not embedded in the deployed JavaScript bundle. The reviewer label is stored locally and attached to decisions.

An **accepted** review item means “reviewed and potentially suitable for promotion”. It does not mean “published”. Phase 7B will add type-specific promotion handlers.

## Public Notice Portal test importer

The reviewer interface includes a manual **Import current Ealing public notices** action.

It checks the current Ealing Planning, Traffic & Roads, Alcohol & Licensing and Statutory index pages at `https://publicnoticeportal.uk/`, extracts canonical notice URLs, and queues a bounded set of current notices as `evidence-suggestion` records.

Only discovery metadata is stored: title, canonical URL, notice type, broad Ealing scope, topic hint and publication date when detectable. Civic Commons does not copy the full notice text, and nothing enters the public timeline or graph without a later review/promotion step.

The Public Notice Portal remains canonical. It is operated by the News Media Association and receives public-notice data from local news publishers.

## Netlify Forms

The Civic Commons project must have Netlify Forms enabled for the two existing static forms to register. Phase 7A enables Forms and then relies on the existing `item-contribution` and `submit-source` form names. Once a production deploy containing those forms completes, Netlify will register them and verified submissions will trigger the review event handler.

## Phase boundary

Phase 7A deliberately stops at **review state**.

Accepting a queue item does **not** automatically publish a contribution, add a source or assert a graph relationship. That keeps the constitutional boundary explicit while we test the queue itself.

Phase 7B can add type-specific promotion handlers while preserving the same stable review IDs and audit history.
