# Ealing Civic Commons — roadmap

**Updated:** 8 September 2026  
**Status:** Public working roadmap

This is the canonical implementation-level roadmap for the Ealing Civic Commons implementation. The public version lives at `/roadmap.html`. The wider Civic Commons network front door is **[civiccommons.co.uk](https://civiccommons.co.uk/)**; local and borough subdomains should always retain a visible route back to it.

The project has moved well beyond the original read-only RSS prototype. It now has six working layers:

1. **Discovery** — local journalism, civic organisations, faith/community institutions, video and official publishing in one provenance-rich timeline.
2. **Participation** — stable item pages, moderated contributions and public reviewed additions.
3. **Following** — account-free browser follows, portable personal RSS and double-opt-in email alerts.
4. **Memory** — persistent civic items, a browsable Civic Archive, Document Watch and reviewed research relationships.
5. **Civic records** — current official/register-derived objects such as the latest validated planning applications, linked into places and issues while the authoritative public register remains canonical.
6. **Review** — a durable moderation queue with audit history, publication reconciliation, contributor receipts and private submission-status pages.

The priority is no longer to invent the social layer. The social and review primitives are live. The next work is to deepen civic memory around places and issues, make planning history persistent across refreshes, improve archive/search infrastructure and keep source growth sustainable.

## September 2026 milestone — planning joins place context

Planning applications from the latest completed Ealing Council PAM week are now exposed as first-class current Civic Commons records rather than merely source links.

Live now:

- Ealing Council PAM/Civica weekly planning ingestion using the live form/session/CSRF state;
- latest completed week chosen in `Europe/London` time;
- multi-page weekly result traversal and detail-summary normalization;
- validated public snapshot generation decoupled from Netlify builds;
- fail-closed publishing so a partial ingest cannot replace the last complete snapshot;
- `/planning/{reference}` routes for records present in the current snapshot;
- conservative town classification and explicit reviewed site-link rules;
- current planning records surfaced on place pages;
- issue pages inheriting current planning through a reviewed primary place;
- first live specific-site relationship: `263308CND` at 2 The Straight → Southall → Southall Gasworks → Southall Gasworks redevelopment issue;
- shared dossier-card presentation for places/entities/issues, with current context before deeper evidence/history;
- section navigation generated in the same order as visible cards;
- one canonical civic-entity template for people, organisations and places.

The key design decision is explicit: **the place is the durable civic object; the current weekly planning snapshot is transient input.**

**Current limitation:** `planning-latest.json` is replaced by each successful refresh. Applications that fall out of the latest week also fall out of the Commons planning/place/issue views. Persistent planning history and stable historical planning routes are therefore planned work, not a live capability yet.

Ealing Council's planning register remains canonical. Civic Commons does not mirror planning documents, drawings or mapping tiles, and planning applicants are not automatically turned into civic profiles.

## Entity completeness standard

A civic entity is not considered complete merely because it has a stable ID and name. Before an entity is treated as finished it should have, at minimum:

1. **Identity** — stable canonical ID, type and route, with useful aliases where needed.
2. **Description** — a reader-facing explanation of who, what or where it is; historical entities must be clearly described as historical where appropriate.
3. **Provenance** — the provider/review layer responsible for the identity or assertion remains explicit.
4. **Source or website** — a first-party website or authoritative source link where one exists; historical entities should link to reviewed evidence or an authoritative reference when a current first-party site is not appropriate.

Explore and the entity APIs should expose missing-description/source audits so incomplete records are discoverable rather than silently rendered as bare names.

## Phase 1 — Read-only civic aggregation

**Status: complete**

The original read-only Civic Commons foundation is live: server-side RSS/Atom ingestion and normalisation; chronological provenance-rich timelines; video/YouTube ingestion; filtered London-wide sources; monitored structured/public pages; town/topic/source-class filtering; visible source health; source submissions; Ealing Council news feeds; Document Watch; selected City Hall/London Assembly material; filtered Met material; Open Council Network public Ealing summaries; ModernGov publication events; and a growing range of community, education, faith, campaign, commentary and local political sources.

Further source discovery, registry migration, parser resilience and upstream interoperability are now normal operations / Phase 8 work rather than unfinished Phase 1 scope.

## Phase 2 — Stable civic items and moderated participation

**Status: complete v1**

Live now:

- deterministic Commons item URLs;
- stable `civic-item:{key}` thread identities;
- “Add to this story” submissions for corrections, evidence, related sources, local information and context;
- public reviewed contributions stored separately from private moderation data;
- approved contributions rendered on permanent item pages;
- contribution activity can resurface an older archived story without pretending the original publisher republished it.

The old manual JSON publication workflow has been superseded by Phase 7B.

## Phase 3 — Follow, RSS and email delivery

**Status: complete v1**

Live now:

- browser-local follows for stories, sources, places and topics;
- a dedicated Following view;
- portable personal RSS URLs;
- reviewed contribution activity in personal feeds;
- account-free, double-opt-in email alerts via Resend;
- confirmation and one-click unsubscribe;
- no open tracking, click tracking, behavioural ranking or advertising profile;
- a public RSS guide.

Still open:

- improve subscription management and explain snapshot semantics more clearly;
- use persistent civic memory to make historical/place follows richer where useful;
- consider optional identity only if it solves a real moderation/subscription problem.

## Phase 4 — Persistent civic memory

**Status: major v1 live**

Live now:

- Netlify Blobs store for normalised civic-item snapshots;
- scheduled archival every 15 minutes;
- stable item pages fall back to the archive after RSS items age out;
- a first-class `/archive.html` Civic Archive with search, source, place and topic filtering plus pagination;
- complete Document Watch stream archived even when selected documents alone reach Latest;
- reviewed context can reactivate an older archived civic item as new Commons activity while preserving the original source/date;
- place/entity/issue dossiers combine current and historical layers without flattening their provenance.

Still open:

- optimise archive indexing as the collection grows;
- stronger date/issue/place facets and richer full-text search;
- define retention/version rules for changed upstream items;
- improve link-rot resilience and preservation of key primary evidence;
- distinguish current representation from historical versions where that matters.

## Phase 5 — Official publishing, Document Watch and public registers

**Status: active; major v1 live**

Live now:

- Ealing Council main news RSS;
- council category feeds used as enrichment rather than duplicate publishers;
- 47 council document-download feeds registered;
- curated Document Watch collections with freshness states;
- dedicated `/document-watch.html` filtering;
- official Ealing Council, London Assembly/City Hall and filtered Met material in the same civic pipeline;
- Open Council Network public Ealing meeting summaries through a conservative public-page bridge;
- ModernGov agenda/minutes/decisions/issues/plans/ePetitions publication events through a public feed-reader bridge while preserving official provenance;
- **latest-week Ealing PAM planning applications as current civic records** with authoritative PAM deep links;
- committed validated planning snapshot separate from the public site build;
- low-rate exact-form/session ingestion rather than public-page scraping on demand.

Next improvements:

- **retain planning records across successful weekly refreshes** with explicit update/version semantics;
- planning lifecycle updates (validated → decided) and decision dates/status history;
- reliable ward/site geography and related-application relationships;
- links between retained planning, committees, decisions, documents and reporting where deterministic/reviewed;
- better direct ModernGov destinations and meeting/document relationships;
- transcript/caption enrichment for official video while keeping original video canonical;
- better document search/indexing and preservation of high-value evidence streams.

## Phase 6 — Reviewed civic graph, place memory and research context

**Status: core live; active refinement**

The Southall Stories research archive supplies a reviewed evidence layer while Civic Commons exposes safe public civic objects.

Live now:

- canonical people, organisation and place pages;
- civic topic pages and Explore/graph surface;
- issue pages, beginning with Southall Gasworks redevelopment;
- reviewed relationships and source records;
- Commons-native reviewed assertions alongside research-archive evidence with provenance preserved;
- entity-note prose flowing into public descriptions;
- first-party/authoritative website or source links where available;
- current and historical identities framed distinctly;
- **current planning → place links with explicit provenance** (`town-classification` vs `reviewed-rule`);
- **issue → primary place → current planning** inheritance without fuzzy name guessing;
- shared clickable dossier-card presentation for entity and issue pages;
- section navigation generated from visible cards in canonical page order;
- one canonical template for all public people/organisation/place routes.

Place memory is a central architectural pattern. A place can accumulate current civic facts, local/public data, current Commons material, primary evidence, historical reporting and reviewed relationships over time. Current planning can now appear alongside those layers, but planning records themselves do not yet persist once they leave the latest snapshot.

Still open:

- complete the entity audit until every public entity meets the **identity + description + provenance + source/website** standard;
- deepen coherent evidence clusters rather than isolated links;
- improve temporal relationships and roles;
- retain and connect planning decisions as historical place evidence;
- connect archived official documents/notices/videos to issues, entities and earlier reporting;
- automate validation so newly introduced incomplete entities are flagged early;
- expand reviewed specific-site relationships only where there is a clear civic-memory benefit.

## Phase 7 — Structured review and civic knowledge

**Status: active — 7A and 7B complete; 7C next**

Phase 7 is the review membrane between submitted/discovered material and reviewed civic knowledge. Community participation is one input, not a prerequisite.

### 7A — durable review queue — complete

Live now:

- private Netlify Blobs review store;
- `pending`, `needs-info`, `accepted` and `rejected` states;
- append-only audit history and reviewer notes;
- review types for item contributions, source submissions, evidence suggestions and relationship suggestions;
- Public Notice Portal candidates can be imported into the queue for human review;
- canonical target checking for item contributions;
- private submitter details remain separate from public records.

### 7B — contribution publication and contributor feedback — complete

Live now:

- **Accept & publish** promotes reviewed item contributions into the public contribution store;
- no manual `contributions.json` editing;
- public records preserve stable contribution ID, civic thread, provenance and publication time;
- accepted-but-unpublished and published states are distinguishable;
- publication can be retried/reconciled safely and withdrawn if moderation changes;
- contributor receipt/outcome emails where an address is supplied;
- private high-entropy submission-status URLs;
- public status pages never expose private moderation notes or submitter details;
- published context can create new Commons activity around an older archived story.

### 7C — unified civic review and promotion — next

Extend the deliberate promotion model one review kind at a time:

- define accepted `source-submission` → source-registry promotion;
- define accepted `evidence-suggestion` → public evidence / Document Watch / Archive / issue/entity relationship;
- define accepted `relationship-suggestion` → reviewed graph assertion;
- preserve an explicit audit link from review record to public representation;
- keep machine/discovery suggestions, private-research candidates and community submissions subject to the same review boundary.

The constitutional rule remains: suggestions can propose civic knowledge; they must not silently become reviewed knowledge without an explicit human decision.

## Phase 8 — Sustainable automation, search and resilience

**Status: partly live; ongoing**

Already automated:

- combined feed aggregation across RSS/Atom, video, filtered broad-area sources, monitored public pages and official-source adapters;
- scheduled email delivery;
- scheduled civic-item archiving;
- browsable persistent Civic Archive;
- research exports and public graph rebuilds after curated changes;
- entity descriptions exported from curated research notes;
- source-health collection with public-friendly status language and debug diagnostics;
- adapter patterns for external sources that block or distort normal server-side access;
- **planning ingestion/validation/latest-snapshot generation separated from Netlify builds**;
- weekly/manual planning refresh that only proposes a public snapshot change when a complete validated ingest changes;
- fail-closed planning publication when discovered/normalised counts do not reconcile.

Next:

- planning retention/versioning across weekly refreshes;
- scalable/sharded archive indexing rather than indefinite whole-store scans;
- stronger feed/planning parser regression tests;
- registry-driven source configuration and safer source lifecycle handling;
- better private source-health review tooling and alerts;
- searchable/grouped source facets as the source universe grows;
- automated completeness checks for public entities/provider links;
- planning snapshot freshness/decision lifecycle monitoring;
- safer refresh/version handling across research, planning and live civic items.

## Public presentation, subdomains and town views

**Status: major v1 partly live**

The Commons has a coherent borough identity plus town-specific presentation for Ealing, Acton, Greenford, Hanwell, Northolt, Perivale and Southall. Town marks and town-aware views are live, while civic data remains one Commons rather than seven duplicated sites.

The navigation hierarchy is explicit:

- **Network front door:** [civiccommons.co.uk](https://civiccommons.co.uk/)
- **Canonical Ealing Commons:** [ealing.civiccommons.co.uk](https://ealing.civiccommons.co.uk/)
- **Southall doorway:** `commons.southallstories.uk` redirects into the Southall-filtered Ealing view.

Entity and issue dossier presentation is standardised around clickable cards. Current context appears before the deeper research dossier, reducing endless-scroll pages without hiding evidence/history. Section navigation must always follow the same order as the rendered cards.

Still open:

- restore town-aware Open Graph/Twitter metadata rendering for stable item/entity routes;
- continue polishing town-specific landing/share behaviour where useful;
- keep town branding consistent without forking the underlying civic data model;
- make network-front-door navigation a standard requirement for every local/borough entry point.

## Later / parallel — federation and external bridges

RSS.chat, ActivityPub, AT Protocol or other open social systems remain possible bridges, not core dependencies.

The Commons should preserve its own public URLs, source provenance, stable item/thread identities, subscriptions, reviewed contributions and civic relationships. External systems should be able to connect to those primitives without owning them.

## Immediate next slice

1. **Retain planning records across weekly refreshes** so planning can genuinely become durable place history.
2. **Extend planning lifecycle memory** — decisions/status history, reliable ward/site geography and related applications.
3. **Connect retained planning to democratic context** — committees, decisions, documents and relevant reporting where deterministic or reviewed.
4. **Build Phase 7C promotion rules** for accepted source submissions and evidence suggestions first, then relationship suggestions.
5. **Improve archive/search indexing** so growth from dozens of sources to hundreds remains fast and complete.
6. **Finish the public entity completeness audit** and automate checks for newly incomplete records.
7. **Harden official-source ingestion** — ModernGov destinations/relationships, planning parser tests, caching and preservation of high-value primary records.
8. **Finish town-aware sharing** by restoring metadata rendering for stable item/entity URLs.
9. **Continue deliberate source expansion by geographic/thematic gap**, especially Perivale, while keeping fragile upstreams visible through source health.
10. **Explore OCN partnership/API and later federation bridges** without making either a dependency.

## Non-negotiable design boundaries

- Original publishers and official registers remain canonical.
- Provenance stays visible, but public wording should be understandable without knowing the ingestion architecture.
- A bare name is not a finished civic entity.
- A person named in a planning/public register is not automatically a civic-profile candidate.
- Places are durable civic-memory objects; weekly planning snapshots and feeds are transient inputs until their records are explicitly retained.
- Specific site relationships should be reviewed/explicit rather than silently inferred through fuzzy text matching.
- Historical and current organisations must be framed temporally rather than flattened together.
- Chronology is not replaced by engagement ranking.
- Participation and civic assertions are moderated rather than popularity-ranked.
- Private submitter details never become public by accident.
- No behavioural advertising.
- No compulsory closed-platform identity.
- The Commons must remain useful when any one external service is unavailable.
- Every local or borough subdomain must retain a visible route back to **[civiccommons.co.uk](https://civiccommons.co.uk/)**.

**Publish anywhere. Connect locally. Participate openly. Remember civically.**
