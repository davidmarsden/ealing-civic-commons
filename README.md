# Ealing Civic Commons — open civic infrastructure prototype

An open civic-information prototype connecting local journalism, community organisations, official publishing, public evidence, planning records and reviewed civic context while keeping provenance and canonical sources visible.

> **Publish anywhere. Connect locally. Participate openly. Remember civically.**

Southall is the starting point, but Ealing Civic Commons is designed for the borough's seven distinct civic places: Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.

## What it does now

### Discovery

- Fetches multiple RSS/Atom feeds server-side through Netlify Functions.
- Normalises items into one chronological civic timeline.
- Uses source-specific public-page and structured-API adapters where useful publishers do not expose a clean native feed.
- Labels source class clearly: official record, journalism/publishing, independent civic data/analysis, organisation/campaign and independent civic commentary.
- Filters the main timeline by town, topic and source type.
- Displays alphabetised public source health so silent feed failures are visible without exposing technical diagnostics by default.
- Links every item back to the original publisher.
- Accepts public source suggestions for human review.
- Integrates **Ealing Culture** through its public WordPress REST API as official civic context: news can enter the timeline, while events are filtered for explicit civic/community relevance rather than reproducing the source's full “What’s on?” listings.

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
- Connects live items to reviewed organisations, places, topics, issues and evidence, plus deliberately registered public people with a documented civic-role rationale.
- Treats places as durable civic objects that can accumulate current material, reviewed facts, primary evidence, historical reporting and reviewed connections.
- Keeps Explore search-first as the entity universe grows rather than rendering every known entity as one giant directory.
- Retains Ealing Culture venue and creative-directory records as **reference data only** for possible future graph/entity matching; creative listings are not automatically promoted into civic person profiles.

### Planning and place context

- Ingests the latest completed Ealing Council PAM planning week through the council's live Civica Public Access form/session flow.
- Publishes a validated static snapshot separately from the Netlify site build, so a council outage cannot break Civic Commons deployment.
- Exposes planning applications under `/planning/{reference}` while keeping Ealing Council's PAM record canonical.
- Publishes factual register metadata rather than mirroring planning documents, drawings or mapping tiles.
- Links applications conservatively to town places and, where deliberately reviewed, to specific sites.
- Lets issues inherit planning context through an explicit primary-place relationship.
- Uses the first live reviewed site relationship to connect `263308CND` at 2 The Straight to **Southall**, **Southall Gasworks**, and the **Southall Gasworks redevelopment** issue.
- Refuses to replace the last complete public planning snapshot with a partial ingest.
- Retains validated planning applications across later weekly refreshes in a durable archive.
- Keeps applicant/agent contact data and unnecessary personal information out of the public civic layer.

The design principle is: **the place is the durable civic object; the weekly planning snapshot is transient input, while retained planning records become part of durable place memory.**

### Civic dossiers

People, organisation, place and issue pages use a shared dossier-card presentation. Major sections are clickable, deep-linkable cards, and section navigation is generated in the same order as the visible cards.

The reader sees the current civic picture first — current facts/local evidence, Current Commons and current planning where available — before the deeper primary evidence, historical reporting and reviewed connections. Heavier research layers can remain collapsed until needed.

All people, organisation and place routes use the same canonical civic-entity template, preventing individual entity pages from silently drifting onto an older presentation path.

### Official publishing and Document Watch

- Ingests Ealing Council's main website news RSS.
- Uses council category feeds as enrichment signals without duplicating stories.
- Discovers the current Ealing Council document-download category registry from the council's downloads index at runtime, with a curated fallback set if discovery is temporarily unavailable.
- Runs a dedicated **Document Watch** section with collection/topic filtering and per-feed freshness diagnostics, including registry-discovery and latest-publication diagnostics.
- Keeps routine council documents out of the main attention timeline while retaining the complete Document Watch stream in persistent civic memory.
- Enriches generic council download entries with the council's own human-readable document descriptions where available.
- Imports ModernGov publication events through a Civic Commons static-egress relay using a DigitalOcean Reserved IP that can be allow-listed upstream; the existing public feed-reader bridge remains as a resilience fallback.
- Integrates Ealing Culture's structured WordPress source without turning Civic Commons into a parallel cultural listings service.

## Development

See the project documentation in `docs/` for architecture, source handling, moderation, following, alerts, persistent civic items, Document Watch, planning ingestion and roadmap details.
