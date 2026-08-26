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
- Accepts proposed new sources through a Netlify Form for human review.

## Current feed set

- Southall Stories
- Community Powered Reporting
- The Neighbours’ Paper
- Southall Residents Alliance
- Southall Transition
- Ealing Matters
- West Ealing Neighbours
- Ealing Transition
- East Acton Golf Links Residents’ Association
- Ealing Council ModernGov
- The View from W5
- MySouthall

Further candidates from the source census can be added incrementally once their preferred public feed endpoints are verified.

## Netlify

Build settings are committed in `netlify.toml`:

- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`

No environment variables are required for Phase 1.

The `submit-source` form uses Netlify Forms. Suggestions are reviewed manually in the Netlify Forms inbox; submission does not automatically add a source.

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
2. Add EALING.NEWS Southall and Asian Standard Southall feeds after endpoint verification.
3. Improve place classification beyond source defaults.
4. Add a source registry file instead of hard-coded feed configuration.
5. Add feed-level conditional requests / caching.
6. Add tests for RSS/Atom parsing and duplicate handling.
7. Add an explicit feedback/correction route.
8. Add the Founding Charter and source-register pages.
9. Validate the public Netlify deployment.
10. Begin OCN pilot conversation and add structured meetings as Phase 2.
