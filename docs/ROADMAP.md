# Southall & Ealing Civic Commons — roadmap

**Updated:** 30 August 2026  
**Status:** Public working roadmap

This is the canonical implementation-level roadmap for the Civic Commons. The public version lives at `/roadmap.html`.

The project has moved beyond the original read-only RSS prototype. It now has four working layers:

1. **Discovery** — local journalism, civic organisations, faith/community institutions, video and official publishing in one provenance-rich timeline.
2. **Participation** — stable item pages, moderated contributions and public reviewed additions.
3. **Following** — account-free browser follows, portable personal RSS and double-opt-in email alerts.
4. **Memory** — persistent civic items, council Document Watch and a reviewed research/relationship layer.

The next work is therefore not “start the social phase”. The social primitives already exist. The priority is to make them durable, searchable, reviewable and useful at borough scale.

## Entity completeness standard

A civic entity is not considered complete merely because it has a stable ID and name. Before an entity is treated as finished it should have, at minimum:

1. **Identity** — stable canonical ID, type and route, with useful aliases where needed.
2. **Description** — a reader-facing explanation of who, what or where it is; historical entities must be clearly described as historical where appropriate.
3. **Provenance** — the provider/review layer responsible for the identity or assertion remains explicit.
4. **Source or website** — a first-party website or authoritative source link where one exists; historical entities should link to reviewed evidence or an authoritative reference when a current first-party site is not appropriate.

Explore and the entity APIs should expose missing-description/source audits so incomplete records are discoverable rather than silently rendered as bare names. New entity work should meet this standard as part of its acceptance criteria.

## Phase 1 — Read-only civic aggregation

**Status: complete for baseline; ongoing source expansion**

Live foundations include:

- server-side RSS/Atom ingestion and normalisation;
- chronological timeline with canonical-source links;
- YouTube/video Atom ingestion with canonical video provenance;
- filtered London-wide feeds for Ealing relevance;
- monitored structured pages and versioned living-publication watches where publishers do not expose feeds;
- town/topic/source-class filtering;
- visible source health and fetch diagnostics;
- public source submissions;
- founding pack, source register, architecture and prospectus;
- Ealing Council website news RSS, ModernGov-derived records and Document Watch;
- selected City Hall / London Assembly feeds and video;
- Ealing-filtered Metropolitan Police material;
- growing community, voluntary-sector, education, faith, campaigning and local political sources.

Still open:

- continue verifying useful local feeds, channels and public pages across all seven towns and communities;
- expand first-party faith/community coverage without treating routine worship notices as civic news;
- move remaining hard-coded source configuration toward a cleaner registry-driven model;
- improve parser tests, conditional requests and caching;
- keep ModernGov access work separate from the rest of the product.

## Phase 2 — Stable civic items and moderated participation

**Status: complete v1**

Live now:

- deterministic Commons item URLs;
- stable `civic-item:{key}` thread identities;
- “Add to this story” submissions for corrections, evidence, related sources, local information and context;
- Netlify Forms moderation inbox;
- reviewed/public contributions stored separately from private submission data;
- contribution validation at build time;
- approved contributions rendered on item pages and surfaced as activity on the timeline.

Still open:

- replace the manual publication registry with a structured review queue/moderation interface;
- keep pending/accepted/rejected state and audit history explicit;
- support contributor history without making a compulsory social account a prerequisite.

## Phase 3 — Follow, RSS and email delivery

**Status: complete v1**

Live now:

- browser-local follows for stories, sources, places and topics;
- a dedicated Following view;
- portable personal RSS URLs using the same combined source stream as the public Commons;
- approved contribution activity in personal feeds;
- account-free, double-opt-in email alerts via Resend;
- confirmation and one-click unsubscribe;
- no open tracking, click tracking, behavioural ranking or advertising profile;
- a public RSS guide.

Still open:

- improve subscription management and explain snapshot semantics more clearly;
- index persistent items so non-item follows can gain richer historical retrieval where useful;
- consider lightweight optional identity only when it solves a real moderation/subscription problem.

## Phase 4 — Persistent civic memory

**Status: core live**

Live now:

- Netlify Blobs store for normalised civic-item snapshots;
- scheduled archival every 15 minutes;
- stable item pages fall back to the archive after RSS items age out;
- directly followed stories remain resolvable in personal RSS;
- canonical publisher URLs and provenance remain primary;
- full Document Watch stream is archived even when only selected documents reach the main timeline;
- living-publication watches create versioned snapshots without inventing dates or fake article URLs.

Still open:

- archive indexes for search/browse by topic, source, place, date and civic issue;
- retention/version rules for changed upstream items;
- stronger link-rot resilience and preservation of key primary evidence;
- distinguish “current representation” from historical versions where that matters.

## Phase 5 — Official publishing and Document Watch

**Status: active; major v1 live**

Live now:

- Ealing Council main news RSS as an official source;
- 13 council news-category feeds used as enrichment signals rather than duplicate publishers;
- 47 council document-download feeds registered;
- a curated live Document Watch set with per-feed freshness states;
- human-readable council document descriptions where Ealing’s download pages expose them;
- dedicated `/document-watch.html` with topic and council-collection filtering;
- routine documents kept out of the main attention timeline unless locally specific or high-signal;
- complete Document Watch stream retained in persistent civic memory;
- official Ealing Council, London Assembly and filtered Met video/news sources feeding the same item pipeline.

Parallel/unresolved:

- ModernGov RSS works in ordinary readers but server-side requests receive HTTP 403;
- OCN API access remains potentially valuable but is not a dependency;
- historical/dormant council feeds need selective review rather than being presented as current.

Next improvements:

- better document search/indexing;
- identify particularly important evidence streams for preservation and relationship-building;
- transcript/caption enrichment for official video while keeping the original video canonical;
- continue improving council taxonomy without reproducing the council website’s confusing information architecture.

## Phase 6 — Reviewed civic graph and research context

**Status: core live; active refinement**

The Southall Stories research archive supplies a reviewed evidence layer while Civic Commons exposes safe public civic objects.

Live now:

- canonical people, organisation and place pages;
- civic topic pages;
- an Explore/graph surface;
- issue pages, beginning with Southall Gasworks redevelopment;
- reviewed relationships and source records;
- related civic memory on relevant stories;
- Commons-native reviewed assertions can sit alongside research-archive evidence while preserving provenance;
- entity-note prose from the research archive now flows into public descriptions;
- Explore can expose first-party/authoritative website or source links;
- current community, faith, political and institutional identities can coexist with clearly historical entities.

Still open:

- complete the entity audit until every public entity meets the **identity + description + provenance + source/website** standard;
- deepen coherent evidence clusters rather than isolated links;
- improve temporal relationships and roles;
- connect newly archived official documents and videos to issues, entities and earlier reporting;
- make relationship language consistently human-readable;
- add automated validation so newly introduced incomplete entities are flagged before they become invisible housekeeping debt.

## Phase 7 — Review workflow and community knowledge

**Status: next major product phase**

Build a durable suggestions/review layer around the primitives already live.

Priorities:

- structured queue for proposed corrections, evidence, related sources and relationships;
- pending / accepted / rejected states;
- reviewer notes and audit trail;
- explicit provenance for every accepted assertion;
- safe promotion from community suggestion to reviewed civic knowledge;
- entity candidates must satisfy the entity completeness standard before promotion to finished public identities;
- moderation tools that do not expose private submission data publicly.

The constitutional rule remains: community input can suggest reviewed knowledge; it must not silently rewrite it.

A future private-research bridge may feed source/assertion candidates from curated unpublished Markdown research, but unpublished material itself must remain private and candidate extraction must never bypass review.

## Phase 8 — Sustainable automation, search and resilience

**Status: partly live; ongoing**

Already automated:

- combined feed aggregation across RSS/Atom, video, filtered broad-area sources and monitored public pages;
- scheduled email delivery;
- scheduled civic-item archiving;
- candidate discovery/research exports after curated changes;
- public graph/export rebuilds;
- entity descriptions exported from curated research notes.

Next:

- automatically detect and preserve new/changed research material;
- archive indexing and search;
- stronger feed caching and parser regression tests;
- source-health review tooling;
- automated completeness checks for public entities and provider/source links;
- safer refresh/version handling across research and live civic items;
- operational monitoring as the source set grows.

## Later / parallel — federation and external bridges

RSS.chat, ActivityPub, AT Protocol or other open social systems remain possible bridges, not core dependencies.

The Commons should preserve its own:

- public URLs;
- source provenance;
- stable item/thread identities;
- subscriptions;
- reviewed contributions and civic relationships.

External systems should be able to connect to those primitives without owning them.

## Immediate next slice

Before adding another major feature family:

1. **Finish the public entity completeness audit** — descriptions everywhere, useful source/website links where available, correct historical/current framing, and automated checks for future additions.
2. **Continue deliberate source expansion** across faith/community organisations, education, law/advice, campaigning and local political sources while preserving first-party provenance and civic-relevance filters.
3. **Build the Phase 7 review queue** so participation can scale beyond a manual JSON publication workflow and future private-research candidates have a safe destination.
4. **Index persistent civic items** for useful archive/search views and richer historical follows.
5. **Connect Document Watch and video to civic memory** by relating selected primary documents/transcripts to issues, entities and reporting.
6. **Strengthen source/config infrastructure**: registry-driven sources, caching, parser tests and source-health tooling.
7. Continue **ModernGov and OCN conversations in parallel**, but do not let either block useful Commons development.

## Non-negotiable design boundaries

- Original publishers and official records remain canonical.
- Provenance stays visible.
- A bare name is not a finished civic entity: public identities need meaningful description and supporting provenance/source context.
- Historical and current organisations must be framed temporally rather than flattened together.
- Chronology is not replaced by engagement ranking.
- Participation is moderated rather than popularity-ranked.
- No behavioural advertising.
- No compulsory closed-platform identity.
- The Commons must remain useful when any one external service is unavailable.

**Publish anywhere. Connect locally. Participate openly. Remember civically.**
