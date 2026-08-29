# Southall & Ealing Civic Commons — open civic infrastructure prototype

An open civic-information prototype connecting local journalism, community organisations, official publishing, public evidence and reviewed civic context while keeping provenance and canonical sources visible.

> **Publish anywhere. Connect locally. Participate openly. Remember civically.**

Southall is the starting point, but the Commons is designed for the borough's seven distinct civic places: Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.

## What it does now

### Discovery

- Fetches multiple RSS/Atom feeds server-side through Netlify Functions.
- Normalises items into one chronological civic timeline.
- Labels source class clearly: official record, journalism/publishing, independent civic data/analysis, organisation/campaign.
- Filters the main timeline by town, topic and source type.
- Displays source health so silent feed failures are visible.
- Links every item back to the original publisher.
- Accepts public source suggestions for human review.

### Participation

- Gives ingested items stable Civic Commons URLs and stable thread IDs.
- Accepts moderated corrections, evidence, related sources, local information and context.
- Publishes approved contributions separately from private submission data.
- Shows approved contribution activity without likes or engagement ranking.

### Following

- Supports browser-local follows for stories, sources, places and topics.
- Provides a dedicated Following view.
- Generates portable personal RSS feeds from the same stable follow identifiers.
- Supports account-free, double-opt-in email alerts with one-click unsubscribe.
- Uses no open tracking, click tracking or behavioural advertising profile.

### Civic memory

- Archives normalised items every 15 minutes using Netlify Blobs.
- Keeps stable item pages useful after upstream RSS items age out.
- Preserves directly followed stories for personal RSS.
- Connects live items to reviewed people, organisations, places, topics, issues and evidence from the research layer.

### Official publishing and Document Watch

- Ingests Ealing Council's main website news RSS.
- Uses council category feeds as enrichment signals without duplicating stories.
- Registers 47 Ealing Council document-download RSS feeds.
- Runs a dedicated **Document Watch** section with collection/topic filtering and freshness diagnostics.
- Keeps routine council documents out of the main attention timeline while retaining the complete Document Watch stream in persistent civic memory.
- Enriches generic council download entries with the council's own human-readable document descriptions where available.

## Public roadmap

The canonical implementation roadmap is [`docs/ROADMAP.md`](./docs/ROADMAP.md).

The plain-language public version is published at `/roadmap.html`.

The project is currently at:

- **Phases 1–3:** complete v1 — aggregation, moderated civic items, follows/RSS/email;
- **Phase 4:** core live — persistent civic memory;
- **Phases 5–6:** active with major v1s live — official publishing/Document Watch and reviewed civic graph;
- **Phase 7:** next major product phase — structured review/community knowledge workflow;
- **Phase 8:** partly live — automation, search and resilience.

## Founding pack and working documentation

The source census, architecture, prospectus and implementation notes are version-controlled in [`docs/`](./docs/):

- [Roadmap](./docs/ROADMAP.md)
- [Founding Pack index](./docs/FOUNDING-PACK.md)
- [Source Register — v0.3](./docs/source-register-v0.3.md)
- [Technical Architecture & Prototype Specification — v0.1](./docs/technical-architecture-spec-v0.1.md)
- [Partner Prospectus](./docs/partner-prospectus.md)
- [Open Social Phase — development direction](./docs/open-social-phase.md)
- [Follow model](./docs/follow-model.md)
- [Personal RSS](./docs/personal-rss.md)
- [Email alerts](./docs/email-alerts.md)
- [Persistent civic items](./docs/persistent-civic-items.md)
- [Ealing Council Document Watch](./docs/ealing-council-document-watch.md)
- [Moderation workflow](./docs/moderation-workflow.md)

These are public so that assumptions, omissions and design decisions can be scrutinised and corrected.

## Development principle: participation and integrations in parallel

Open Council Network, Ealing Council/ModernGov, RSS.chat and other open systems can substantially enrich the Commons. None is allowed to become a prerequisite for the Commons remaining useful.

ModernGov RSS currently works in ordinary browsers/feed readers but server-side Civic Commons requests receive HTTP 403, so that access issue is kept separate from the working council news and Document Watch layers.

The OCN Ealing feed currently uses Reddit's public subreddit search RSS as an experimental public signal rather than the paid OCN API. Canonical links remain the original posts and the source is labelled as independent civic data/analysis rather than an official council record.

## Source model

The live set now includes local journalism, community organisations, civic groups and official publishing, including Southall Stories, Community Powered Reporting, Ealing Matters, Ealing Civic Society, Ealing Council news and the experimental OCN Ealing stream.

Further candidates from the source census are added incrementally once preferred public endpoints and provenance are verified. Some useful local sources without a feed remain transparent reference sources rather than being falsely presented as live aggregation.

## Source submissions

The public **Submit a source** form uses Netlify Forms. Suggestions are reviewed manually and do not automatically become Civic Commons sources.

## Netlify

Build settings are committed in `netlify.toml`:

- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`

Email delivery additionally requires:

- `RESEND_API_KEY`
- `EMAIL_FROM`

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

1. Build a structured moderation/review queue with explicit pending, accepted and rejected states plus an audit trail.
2. Add archive indexes/search over persistent civic items by topic, source, date and issue.
3. Connect selected Document Watch evidence to issues, entities and earlier reporting.
4. Move more source configuration into registry-driven data rather than hard-coded feed logic.
5. Strengthen feed caching, conditional requests, parser regression tests and source-health tooling.
6. Improve place/topic classification where source defaults are too coarse or where Ealing borough/town ambiguity matters.
7. Continue ModernGov and OCN discussions/integration experiments in parallel, without blocking the rest of the roadmap.
8. Explore federation/bridges such as RSS.chat, ActivityPub or AT Protocol only after the native review/memory model is solid.

The Commons should remain useful if any one external service is unavailable.
