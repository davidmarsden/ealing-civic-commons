# Southall & Ealing Civic Commons — open civic prototype

An open civic-information prototype connecting local journalism, community organisations and official democratic records while keeping provenance and canonical sources visible.

> **Publish anywhere. Connect locally. Keep the sources open.**

Southall is the starting point, but the Commons is designed for the borough's seven distinct civic places: Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.

## What it does now

- Fetches multiple RSS/Atom feeds server-side through a Netlify Function.
- Normalises items into one chronological civic timeline.
- Labels source class clearly: official record, journalism/publishing, independent civic data/analysis, organisation/campaign.
- Filters by town, topic and source type.
- Defaults to Southall.
- Displays source health so silent feed failures are visible.
- Links every item back to the original publisher.
- Accepts public source suggestions for human review.
- Publishes its founding documents and development assumptions openly.

## Founding pack

The working source census, architecture and prospectus are version-controlled in [`docs/`](./docs/):

- [Founding Pack index](./docs/FOUNDING-PACK.md)
- [Source Register — v0.3](./docs/source-register-v0.3.md)
- [Technical Architecture & Prototype Specification — v0.1](./docs/technical-architecture-spec-v0.1.md)
- [Partner Prospectus](./docs/partner-prospectus.md)
- [Open Social Phase — development direction](./docs/open-social-phase.md)

These are public so that assumptions, omissions and design decisions can be scrutinised and corrected.

## Development principle: participation and integrations in parallel

Open Council Network and Ealing Council can substantially enrich the Commons. Conversations and integrations with them can continue in parallel while the participation layer develops.

The current direction is described in [`docs/open-social-phase.md`](./docs/open-social-phase.md).

Initial social work can include stable Commons item URLs, town/topic/source following, corrections, related evidence, contributions and moderated discussion. External systems such as RSS.chat, ActivityPub or AT Protocol can later connect to those open primitives without becoming dependencies.

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
- Open Council Network — Ealing updates (experimental Reddit search RSS)
- The View from W5
- MySouthall
- The Neighbours’ Paper (candidate `/feed/` endpoint under live verification)

The OCN feed uses Reddit's public subreddit search RSS for `Ealing`. It is treated as independent civic data/analysis, not as an official council record and not as a substitute for OCN's paid API. Its canonical links remain the original Reddit posts.

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

No environment variables are required for the current prototype.

## Run locally

```bash
npm install
npx netlify dev
```

## Build

```bash
npm run build
```

## Immediate development priorities

1. Begin Social Phase A: stable item permalinks and open participation primitives.
2. Add correction / related evidence submissions at item level.
3. Prototype follow/subscribe for town, topic and source without behavioural profiling.
4. Add basic moderated item discussion/contributions.
5. Add a source registry file instead of hard-coded feed configuration.
6. Improve place classification beyond source defaults.
7. Add feed-level conditional requests / caching and parser tests.
8. Add EALING.NEWS Southall and Asian Standard Southall after endpoint verification.
9. Continue OCN pilot discussions and public-feed experiments in parallel.
10. Continue working with Ealing Council/ModernGov on reliable official-feed access in parallel.

The Commons should remain useful if any one external service is unavailable.
