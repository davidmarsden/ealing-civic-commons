# Southall & Ealing Civic Commons — roadmap

**Updated:** 29 August 2026  
**Status:** Public working roadmap

This is the canonical implementation-level roadmap for the Civic Commons. The public version lives at `/roadmap.html`.

The project has moved beyond the original read-only RSS prototype. It now has four working layers:

1. **Discovery** — local journalism, civic organisations and official publishing in one provenance-rich timeline.
2. **Participation** — stable item pages, moderated contributions and public reviewed additions.
3. **Following** — account-free browser follows, portable personal RSS and double-opt-in email alerts.
4. **Memory** — persistent civic items, council Document Watch and a reviewed research/relationship layer.

The next work is therefore not “start the social phase”. The social primitives already exist. The priority is to make them durable, searchable, reviewable and useful at borough scale.

## Phase 1 — Read-only civic aggregation

**Status: complete for baseline; ongoing source expansion**

Live foundations include:

- server-side RSS/Atom ingestion and normalisation;
- chronological timeline with canonical-source links;
- town/topic/source-class filtering;
- visible source health and fetch diagnostics;
- public source submissions;
- founding pack, source register, architecture and prospectus;
- OCN Ealing paragraph extraction from the experimental Reddit feed;
- Ealing Council website news RSS;
- Ealing Civic Society and other independent civic/community sources.

Still open:

- continue verifying useful local feeds;
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
- portable personal RSS URLs using the same stable follow identifiers;
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
- full Document Watch stream is archived even when only selected documents reach the main timeline.

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
- complete Document Watch stream retained in persistent civic memory.

Parallel/unresolved:

- ModernGov RSS works in ordinary readers but server-side requests receive HTTP 403;
- OCN API access remains potentially valuable but is not a dependency;
- historical/dormant council feeds need selective review rather than being presented as current.

Next improvements:

- better document search/indexing;
- identify particularly important evidence streams for preservation and relationship-building;
- continue improving council taxonomy without reproducing the council website’s confusing information architecture.

## Phase 6 — Reviewed civic graph and research context

**Status: core live; active refinement**

The Southall-Zettel research archive supplies a reviewed evidence layer while Civic Commons exposes safe public civic objects.

Live now:

- canonical people, organisation and place pages;
- civic topic pages;
- an Explore/graph surface;
- issue pages, beginning with Southall Gasworks redevelopment;
- reviewed relationships and source records;
- related civic memory on relevant stories;
- Commons-native reviewed assertions can sit alongside research-archive evidence while preserving provenance.

Still open:

- deepen coherent evidence clusters rather than isolated links;
- improve temporal relationships and roles;
- connect newly archived official documents to issues, entities and earlier reporting;
- make relationship language consistently human-readable.

## Phase 7 — Review workflow and community knowledge

**Status: next major product phase**

Build a durable suggestions/review layer around the primitives already live.

Priorities:

- structured queue for proposed corrections, evidence, related sources and relationships;
- pending / accepted / rejected states;
- reviewer notes and audit trail;
- explicit provenance for every accepted assertion;
- safe promotion from community suggestion to reviewed civic knowledge;
- moderation tools that do not expose private submission data publicly.

The constitutional rule remains: community input can suggest reviewed knowledge; it must not silently rewrite it.

## Phase 8 — Sustainable automation, search and resilience

**Status: partly live; ongoing**

Already automated:

- feed aggregation;
- scheduled email delivery;
- scheduled civic-item archiving;
- candidate discovery/research exports after curated changes;
- public graph/export rebuilds.

Next:

- automatically detect and preserve new/changed research material;
- archive indexing and search;
- stronger feed caching and parser regression tests;
- source-health review tooling;
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

1. **Build the Phase 7 review queue** so participation can scale beyond a manual JSON publication workflow.
2. **Index persistent civic items** for useful archive/search views and richer historical follows.
3. **Connect Document Watch to civic memory** by relating selected primary documents to issues, entities and reporting.
4. **Strengthen source/config infrastructure**: registry-driven sources, caching, parser tests and source-health tooling.
5. Continue **ModernGov and OCN conversations in parallel**, but do not let either block useful Commons development.

## Non-negotiable design boundaries

- Original publishers and official records remain canonical.
- Provenance stays visible.
- Chronology is not replaced by engagement ranking.
- Participation is moderated rather than popularity-ranked.
- No behavioural advertising.
- No compulsory closed-platform identity.
- The Commons must remain useful when any one external service is unavailable.

**Publish anywhere. Connect locally. Participate openly. Remember civically.**
