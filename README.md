# Southall & Ealing Civic Commons — Phase 1 prototype

A deliberately small read-only prototype demonstrating the core proposition: connect local journalism, community organisations and official democratic records while keeping provenance and canonical sources visible.

## What it does

- Fetches multiple RSS/Atom feeds server-side through a Netlify Function.
- Normalises items into one chronological civic timeline.
- Labels source class clearly: official record, journalism/publishing, organisation/campaign.
- Filters by town, topic and source type.
- Defaults to Southall.
- Displays source health so silent feed failures are visible.
- Links every item back to the original publisher.
- Accepts public source suggestions through a Netlify Form for human review.

## Current live feed set

- Southall Stories
- Community Powered Reporting
- Southall Residents Alliance
- Southall Transition
- Ealing Matters
- West Ealing Neighbours
- Ealing Transition
- East Acton Golf Links Residents’ Association
- Ealing Council ModernGov
- The View from W5
- MySouthall
- The Neighbours’ Paper (candidate `/feed/` endpoint under live verification)

Further candidates from the source census can be added incrementally once their preferred public feed endpoints are verified.

## Reference sources

Some useful local sources do not expose a verified feed. They may still be listed transparently as reference/local-information sources without pretending they are part of the live aggregation.

- **Ealing.com** — https://www.ealing.com/ — independent commercial local guide and practical information resource. No verified RSS/Atom feed found, so it is listed for reference rather than ingested into the timeline.

## Source submissions

The public **Submit a source** form uses Netlify Forms. Suggestions are reviewed manually and do not automatically become Civic Commons sources. The form includes source name, URL, area, type, optional notes and optional contact email.

## Netlify

Build settings are committed in `netlify.toml`:

- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`

No environment variables are required for Phase 1.

## Run locally

```bash
npm install
npx netlify dev
```

## Build

```bash
npm run build
```

## Phase 1 next steps

1. Verify The Neighbours’ Paper feed in the Netlify source-health panel.
2. Test a source submission end-to-end in Netlify Forms.
3. Add EALING.NEWS Southall and Asian Standard Southall feeds after endpoint verification.
4. Improve place classification beyond source defaults.
5. Add a source registry file instead of hard-coded feed configuration.
6. Add feed-level conditional requests / caching.
7. Add tests for RSS/Atom parsing and duplicate handling.
8. Add an explicit feedback/correction route.
9. Add the Founding Charter and source-register pages.
10. Begin OCN pilot conversation and add structured meetings as Phase 2.
