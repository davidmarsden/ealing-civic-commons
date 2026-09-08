# Southall & Ealing Civic Commons — open civic infrastructure prototype

An open civic-information prototype connecting local journalism, community organisations, official publishing, public evidence, planning records and reviewed civic context while keeping provenance and canonical sources visible.

> **Publish anywhere. Connect locally. Participate openly. Remember civically.**

Southall is the starting point, but the Commons is designed for the borough's seven distinct civic places: Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.

## What it does now

### Discovery

- Fetches multiple RSS/Atom feeds server-side through Netlify Functions.
- Normalises items into one chronological civic timeline.
- Uses source-specific public-page adapters where useful publishers do not expose a clean native feed.
- Labels source class clearly: official record, journalism/publishing, independent civic data/analysis, organisation/campaign and independent civic commentary.
- Filters the main timeline by town, topic and source type.
- Displays alphabetised public source health so silent feed failures are visible without exposing technical diagnostics by default.
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
- Connects live items to reviewed organisations, places, topics, issues and evidence, plus deliberately registered public people with a documented civic-role rationale.
- Treats places as durable civic objects that can accumulate current material, reviewed facts, planning records, primary evidence, historical reporting and reviewed connections.
- Keeps Explore search-first as the entity universe grows rather than rendering every known entity as one giant directory.

### Planning and place history

- Ingests the latest completed Ealing Council PAM planning week through the council's live Civica Public Access form/session flow.
- Publishes a validated static snapshot separately from the Netlify site build, so a council outage cannot break Civic Commons deployment.
- Gives planning applications stable Civic Commons objects under `/planning/{reference}` while keeping Ealing Council's PAM record canonical.
- Publishes factual register metadata rather than mirroring planning documents, drawings or mapping tiles.
- Links applications conservatively to town places and, where deliberately reviewed, to specific sites.
- Lets issues inherit planning context through an explicit primary-place relationship.
- Uses the first live reviewed site relationship to connect `263308CND` at 2 The Straight to **Southall**, **Southall Gasworks**, and the **Southall Gasworks redevelopment** issue.
- Refuses to replace the last complete public planning snapshot with a partial ingest.
- Keeps applicant/agent contact data and unnecessary personal information out of the public civic layer.

The design principle is simple: **the weekly list is temporary input; the place is the durable civic object.**

### Civic dossiers

People, organisation, place and issue pages now use a shared dossier-card presentation. Major sections are clickable, deep-linkable cards, and section navigation is generated in the same order as the visible cards.

The reader sees the current civic picture first — current facts/local evidence, Current Commons and planning where available — before the deeper primary evidence, historical reporting and reviewed connections. Heavier research layers can remain collapsed until needed.

All people, organisation and place routes use the same canonical civic-entity template, preventing individual entity pages from silently drifting onto an older presentation path.

### Official publishing and Document Watch

- Ingests Ealing Council's main website news RSS.
- Uses council category feeds as enrichment signals without duplicating stories.
- Registers 47 Ealing Council document-download RSS feeds.
- Runs a dedicated **Document Watch** section with collection/topic filtering and freshness diagnostics.
- Keeps routine council documents out of the main attention timeline while retaining the complete Document Watch stream in persistent civic memory.
- Enriches generic council download entries with the council's own human-readable document descriptions where available.
- Imports ModernGov publication events through a public feed-reader bridge because direct server-to-server access is blocked upstream.

## Public roadmap

The canonical implementation roadmap is [`docs/ROADMAP.md`](./docs/ROADMAP.md).

The plain-language public version is published at `/roadmap.html`.

The project is currently at:

- **Phases 1–3:** complete v1 — aggregation, moderated civic items, follows/RSS/email;
- **Phase 4:** major v1 live — persistent civic memory and Archive;
- **Phases 5–6:** active with major/core v1s live — official publishing/Document Watch, planning records/place memory and reviewed civic graph;
- **Phase 7:** active — 7A durable review queue and 7B contribution publication/feedback are complete; 7C structured promotion is next;
- **Phase 8:** partly live — automation, search, source operations, planning refresh and resilience.

## Founding pack and working documentation

The source census, architecture, prospectus and implementation notes are version-controlled in [`docs/`](./docs/):

- [Roadmap](./docs/ROADMAP.md)
- [Founding Pack index](./docs/FOUNDING-PACK.md)
- [Source Register — v0.4](./docs/source-register-v0.4.md)
- [Source Register — v0.3 historical census](./docs/source-register-v0.3.md)
- [Public people entities — publication and minimisation policy](./docs/public-people-entities.md)
- [Technical Architecture & Prototype Specification — v0.1](./docs/technical-architecture-spec-v0.1.md)
- [Planning integration](./docs/planning-probe.md)
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

Open Council Network, Ealing Council/ModernGov/PAM, RSS.chat and other open systems can substantially enrich the Commons. None is allowed to become a prerequisite for the Commons remaining useful.

ModernGov remains the publisher of its official RSS events. Because direct server-side requests are blocked, Civic Commons currently transports those events through a public feed reader and keeps the official ModernGov destination/provenance visible.

Ealing Council PAM remains canonical for planning applications. Civic Commons keeps a reviewed, validated discovery snapshot and stable civic relationships but does not replace the council register or document store.

Open Council Network public Ealing summaries are integrated through a conservative public-page bridge. A richer API/partnership could add more structured meeting and document relationships later, but it is not a dependency.

## Source model

The live source universe now spans local journalism, community organisations, campaign publishing, independent commentary, party-political publishing and official records. Recent additions include Stop The Towers, Friends of the Victoria Hall, Southall Speaks, Visit Southall, Vicious Ealing Council, EALING.NEWS, LAGER Can, Ealing Labour, Ealing Conservatives, Ealing Green Party, Ealing Liberal Democrats, Hanwell Community Forum, Southall Community Alliance, Norwood Green Residents’ Association and Bedford Park Society, alongside the established journalism, community and official sources.

The human-readable [Source Register v0.4](./docs/source-register-v0.4.md) distinguishes sources that are actually **INGESTING** from those that are merely **VERIFIED**, **CANDIDATE**, **PARTNER** or **REFERENCE**. Production source definitions and public source-health output remain authoritative for live operational state.

Native RSS remains the preferred path when available, but it is no longer the only path: source-specific public-page adapters, official-register adapters and cautious fallbacks are established ingestion patterns where they preserve first-party provenance and stable identities.

Further candidates are added deliberately to fill geographic and thematic gaps rather than simply maximise source count. Positive Greenford and Visions for Northolt are already live; Hanwell coverage has improved with Hanwell Community Forum; Southall/Norwood Green community coverage has deepened. **Perivale remains the clearest geographic publishing gap.**

## Public entity model

The public civic graph distinguishes between **public profiles**, **searchable civic references** and **incidental mentions**. Public profiles are reserved for people with a documented civic role; typed search may also surface materially recurring names as limited references without creating a standalone biography or route. Incidental one-off names remain only in their canonical sources.

The same threshold applies to people involved in building or publishing Civic Commons. Founders, publishers and contributors do not receive extra prominence simply because they are close to the project.

Explore therefore defaults to search rather than dumping the whole entity universe onto one page. Entity-type browse views are bounded, and search can recover useful civic references without turning the site into an ever-growing people directory.

Planning applicants are not automatically promoted into public civic profiles merely because a name appears on a public register.

## Source submissions

The public **Submit a source** form uses Netlify Forms. Suggestions are reviewed manually and do not automatically become Civic Commons sources.

## Netlify

Build settings are committed in `netlify.toml`:

- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`

Planning ingestion/refresh is deliberately decoupled from this build. A separate workflow updates the committed snapshot only after a complete validated ingest.

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

1. Extend planning from a live weekly discovery layer into richer lifecycle memory: decisions, reliable ward/site geography, related applications and reviewed links to meetings/documents/reporting.
2. Build Phase 7C promotion rules for accepted source submissions and evidence suggestions first, then relationship suggestions.
3. Connect accepted evidence to archived stories, Document Watch records, issues, entities and earlier reporting without duplicating canonical source material.
4. Improve Archive indexing/search and grouped source filtering so growth from dozens of publishers to hundreds remains usable.
5. Complete public civic representation deliberately: add all current Ealing councillors, then expand institutions such as libraries, schools, colleges, faith institutions and major community bodies while applying the public-people threshold to named representatives.
6. Finish the wider public entity completeness audit and automate checks for newly incomplete records.
7. Harden official-source ingestion, especially ModernGov direct destinations, meeting/document relationships, parser tests, caching and preservation of high-value primary records.
8. Finish town-aware social metadata routing so existing share-card assets are actually emitted for public item/entity URLs.
9. Continue deliberate source expansion by genuine geographic/thematic gap — especially Perivale — while hardening existing adapters and keeping fragile upstreams visible through source health.
10. Explore OCN partnership/API and later federation bridges in parallel without making either a dependency.

The Commons should remain useful if any one external service is unavailable.
