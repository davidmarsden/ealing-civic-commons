# WhatDoTheyKnow source integration

## Purpose

Add WhatDoTheyKnow (WDTK), the UK Alaveteli installation, as a reusable Civic Commons evidence source, beginning with requests to the London Borough of Ealing.

Unlike a conventional news/RSS source, an FOI/EIR request is a durable civic evidence object. The Commons should preserve the request as the primary item and retain its relationship to the public authority, correspondence, disclosed attachments and any Commons entities/topics we can identify.

## Why this belongs in the Commons

WhatDoTheyKnow is a public repository of information requests and published responses. Historic requests can expose records that are difficult to discover on an authority's own website and can connect to planning cases, places, organisations, councillors, council services and investigations already represented in the Commons.

This source should therefore support both:

1. ongoing discovery of new and updated requests; and
2. a controlled historical backfill.

## Upstream capabilities

Alaveteli provides public read interfaces suitable for this work:

- Atom feeds on pages that list requests;
- feeds for advanced searches, including authority/date/status/file-type queries;
- JSON representations of authorities and requests by appending `.json`;
- JSON equivalents of Atom feeds.

The adapter should prefer these documented structured interfaces over HTML scraping.

Reference: https://alaveteli.org/docs/developers/api/

## Initial scope

Start with the WhatDoTheyKnow authority representing the London Borough of Ealing. The authority slug must be discovered/verified by the probe rather than silently assumed in production configuration.

The first implementation should:

- probe the authority and its structured endpoints;
- enumerate request summaries from an authority-scoped feed/search;
- normalise requests into a stable intermediate representation;
- retain the canonical WDTK URL and upstream identifiers;
- record request state/status where exposed;
- record created/updated/event dates where exposed;
- retain authority identity;
- expose correspondence/attachment metadata when the request JSON makes it available;
- avoid treating each email in a request thread as an independent Commons item;
- produce deterministic IDs so repeated ingestion updates rather than duplicates requests.

## Proposed Commons model

A WDTK request is the primary source item.

Suggested fields in the normalised adapter output:

```json
{
  "source": "whatdotheyknow",
  "sourceType": "foi-request",
  "sourceId": "<stable upstream id or canonical slug>",
  "url": "<canonical request URL>",
  "title": "<request title>",
  "authority": {
    "name": "<authority name>",
    "urlName": "<authority slug>",
    "url": "<canonical authority URL>"
  },
  "status": "<Alaveteli request state>",
  "createdAt": "<ISO date if available>",
  "updatedAt": "<ISO date if available>",
  "summary": "<safe text summary/excerpt if available>",
  "correspondence": [],
  "attachments": [],
  "tags": []
}
```

This is an adapter contract, not necessarily the final site schema. Mapping into the existing Commons item/entity model should happen after the probe confirms the real WDTK payloads.

## Relationships and enrichment

After ingestion, existing Commons enrichment can propose links from requests to:

- Places
- Organisations
- People
- planning applications/reference numbers
- council meetings/decisions
- topics and investigations

These should be evidence-backed or reviewable proposals rather than inferred facts silently asserted by the importer.

Requester names require particular care. A name appearing as the requester on WDTK should not automatically create a Commons Person profile. It is source metadata unless an independently warranted civic entity already exists or is deliberately reviewed.

## Attachments and disclosures

Disclosed files are evidence belonging to the request thread. Phase one should preserve their upstream metadata and canonical links rather than mirror arbitrary files into the repository.

A later archival phase can decide whether selected public disclosures should be captured into a persistent evidence store, with provenance, content type, checksum and retrieval date.

## Historical backfill

Backfill should be separate from routine incremental ingestion.

Requirements:

- resumable pagination;
- deterministic IDs/deduplication;
- bounded requests and polite rate limiting;
- checkpoint/progress output;
- date-range controls;
- dry-run/preview output before publication;
- no assumption that an old request's current classification perfectly describes its historical state.

The first useful backfill is all discoverable London Borough of Ealing requests. Once that works, configuration can support additional locally relevant authorities without changing adapter code.

## Configuration direction

Keep the adapter generic, for example:

```json
{
  "type": "whatdotheyknow",
  "baseUrl": "https://www.whatdotheyknow.com",
  "authorities": [
    {
      "urlName": "<verified-ealing-authority-slug>",
      "commonsOrganisation": "<existing Commons organisation id>"
    }
  ]
}
```

This makes the implementation reusable by future Civic Commons installations using WhatDoTheyKnow or, with minor generalisation, other Alaveteli instances.

## Implementation sequence

1. Add a `whatdotheyknow-probe` script that discovers/verifies the authority and records the shapes/capabilities of its Atom/JSON endpoints.
2. Commit a small fixture derived from public structured data, with personal/request message content minimised where possible.
3. Add parser tests against the fixture.
4. Implement normalisation and preview ingestion for Ealing.
5. Map normalised requests into the existing Commons item/source pipeline.
6. Add the source to the Source Register and document provenance/update behaviour.
7. Run a bounded historical backfill preview and review the resulting entity/topic links before publishing it.
8. Add scheduled incremental updates only after the backfill/parser behaviour is understood.

## Acceptance criteria for the first implementation PR

- No HTML scraping is required for ordinary request discovery.
- The Ealing authority is verified against WDTK rather than guessed.
- At least one real request can be represented from structured upstream data in a deterministic normalised form.
- Re-running the importer cannot create duplicate items for the same request.
- Request thread/correspondence remains attached to one request item.
- Requester metadata does not automatically create Person entities.
- Failures are explicit and do not silently publish empty/stale data.
- The adapter is configurable for another authority without code changes.
