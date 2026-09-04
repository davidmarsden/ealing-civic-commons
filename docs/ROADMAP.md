# Southall & Ealing Civic Commons — roadmap

**Updated:** 4 September 2026  
**Status:** Public working roadmap

This is the canonical implementation-level roadmap for the Civic Commons. The public version lives at `/roadmap.html`.

The project has moved well beyond the original read-only RSS prototype. It now has five working layers:

1. **Discovery** — local journalism, civic organisations, faith/community institutions, video and official publishing in one provenance-rich timeline.
2. **Participation** — stable item pages, moderated contributions and public reviewed additions.
3. **Following** — account-free browser follows, portable personal RSS and double-opt-in email alerts.
4. **Memory** — persistent civic items, a browsable Civic Archive, council Document Watch and reviewed research relationships.
5. **Review** — a durable moderation queue with audit history, publication reconciliation, contributor receipts and private submission-status pages.

The priority is no longer to invent the social layer. The social and review primitives are live. The next work is to extend structured promotion to more evidence types, improve archive/search infrastructure and keep source growth sustainable.

## Entity completeness standard

A civic entity is not considered complete merely because it has a stable ID and name. Before an entity is treated as finished it should have, at minimum:

1. **Identity** — stable canonical ID, type and route, with useful aliases where needed.
2. **Description** — a reader-facing explanation of who, what or where it is; historical entities must be clearly described as historical where appropriate.
3. **Provenance** — the provider/review layer responsible for the identity or assertion remains explicit.
4. **Source or website** — a first-party website or authoritative source link where one exists; historical entities should link to reviewed evidence or an authoritative reference when a current first-party site is not appropriate.

Explore and the entity APIs should expose missing-description/source audits so incomplete records are discoverable rather than silently rendered as bare names.

## Phase 1 — Read-only civic aggregation

**Status: complete**

The original read-only Civic Commons foundation is live: server-side RSS/Atom ingestion and normalisation; chronological provenance-rich timelines; video/YouTube ingestion; filtered London-wide sources; monitored structured/public pages; town/topic/source-class filtering; visible source health; source submissions; Ealing Council news feeds; Document Watch; selected City Hall/London Assembly material; filtered Met material; Open Council Network public Ealing summaries; ModernGov publication events; and a growing range of community, education, faith, campaign and local political sources.

Further source discovery, registry migration, parser resilience and upstream interoperability are continuing operational/infrastructure work rather than unfinished Phase 1 scope. They now sit primarily in Phase 8 and normal source operations:

- continue verifying useful local feeds, channels and public pages across all seven towns and communities;
- expand first-party community/faith coverage without turning routine notices into civic news;
- move remaining hard-coded source configuration toward a cleaner registry-driven model;
- improve parser tests, conditional requests and caching;
- prefer resilient adapters/bridges for awkward upstreams without allowing one external service to block the Commons.

## Phase 2 — Stable civic items and moderated participation

**Status: complete v1**

Live now:

- deterministic Commons item URLs;
- stable `civic-item:{key}` thread identities;
- “Add to this story” submissions for corrections, evidence, related sources, local information and context;
- public reviewed contributions stored separately from private moderation data;
- approved contributions rendered on permanent item pages;
- contribution activity can resurface an older archived story without pretending the original publisher republished it.

The old manual JSON publication workflow has now been superseded by Phase 7B.

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
- use the persistent archive to make historical follows richer where useful;
- consider optional identity only if it solves a real moderation/subscription problem.

## Phase 4 — Persistent civic memory

**Status: major v1 live**

Live now:

- Netlify Blobs store for normalised civic-item snapshots;
- scheduled archival every 15 minutes;
- stable item pages fall back to the archive after RSS items age out;
- a first-class `/archive.html` Civic Archive with search, source, place and topic filtering plus pagination;
- archive browsing reads the authoritative item store rather than imposing an arbitrary fixed-history ceiling;
- directly followed stories remain resolvable in personal RSS;
- complete Document Watch stream is archived even when only selected documents reach Latest;
- reviewed context can reactivate an older archived civic item as new Commons activity while preserving the original publication date and source.

Still open:

- optimise archive indexing as the collection grows into tens of thousands of records;
- add stronger date/issue facets and richer full-text search;
- define retention/version rules for changed upstream items;
- improve link-rot resilience and preservation of key primary evidence;
- distinguish current representation from historical versions where that matters.

## Phase 5 — Official publishing and Document Watch

**Status: active; major v1 live**

Live now:

- Ealing Council main news RSS;
- 13 council news-category feeds used as enrichment rather than duplicate publishers;
- 47 council document-download feeds registered;
- curated Document Watch collections with freshness states;
- human-readable document descriptions where the council exposes them;
- dedicated `/document-watch.html` filtering;
- full Document Watch memory retained even when routine files stay out of Latest;
- official Ealing Council, London Assembly/City Hall and filtered Met material in the same civic pipeline;
- Open Council Network public Ealing meeting summaries integrated through a conservative public-page bridge, with direct links back to OCN;
- Ealing ModernGov publication events integrated from the official RSS feed through a public feed-reader bridge after direct server-side requests were blocked;
- ModernGov agenda, minutes, decisions, issues, plans and ePetitions are normalised as official records while preserving the original council publisher and public destination links.

Parallel/unresolved:

- a formal OCN API/partnership remains potentially valuable for richer structured meeting/document relationships, but the current public-page bridge already provides useful coverage and the paid API is not a dependency;
- some ModernGov event links need better direct public destinations where the feed exposes login-oriented or generic URLs;
- historical/dormant council feeds need selective review rather than presentation as current.

Next improvements:

- better document search/indexing;
- preservation and relationship-building around high-value evidence streams;
- richer relationships between ModernGov events, meetings, committees, documents, issues and civic entities;
- transcript/caption enrichment for official video while keeping the original video canonical;
- continue improving council taxonomy without reproducing the council website’s information architecture.

## Phase 6 — Reviewed civic graph and research context

**Status: core live; active refinement**

The Southall Stories research archive supplies a reviewed evidence layer while Civic Commons exposes safe public civic objects.

Live now:

- canonical people, organisation and place pages;
- civic topic pages and Explore/graph surface;
- issue pages, beginning with Southall Gasworks redevelopment;
- reviewed relationships and source records;
- related civic memory on relevant stories;
- Commons-native reviewed assertions alongside research-archive evidence with provenance preserved;
- entity-note prose flowing into public descriptions;
- first-party/authoritative website or source links where available;
- current and historical identities framed distinctly.

Still open:

- complete the entity audit until every public entity meets the **identity + description + provenance + source/website** standard;
- deepen coherent evidence clusters rather than isolated links;
- improve temporal relationships and roles;
- connect archived official documents, notices and videos to issues, entities and earlier reporting;
- automate validation so newly introduced incomplete entities are flagged early.

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

- **Accept & publish** automatically promotes reviewed `item-contribution` records into the public contribution store;
- no manual `contributions.json` editing;
- public records preserve stable contribution ID, civic thread, provenance and publication time;
- accepted-but-unpublished and published states are distinguishable in review;
- publication can be retried/reconciled safely and withdrawn if a later moderation decision changes;
- contributor receipt emails when an address is supplied;
- meaningful outcome emails for published, needs-info and not-published decisions;
- private high-entropy submission-status URLs for contributors with or without email;
- status pages expose only public-safe state, dates and links — never email addresses, private moderation notes or reviewer identity;
- notification delivery is deduplicated for ordinary sequential retries and is fail-soft; concurrent duplicate deliveries are not yet protected by an atomic claim;
- published context can create new Commons activity around an older archived story.

### 7C — unified civic review and promotion — next

Extend the same deliberate promotion model one review kind at a time:

- define what accepting a `source-submission` means operationally and how a source enters the source registry safely;
- define how accepted `evidence-suggestion` records become public evidence, Document Watch/Archive relationships or issue/entity links;
- define how accepted `relationship-suggestion` records become reviewed graph assertions;
- preserve an explicit audit link from review record to public representation;
- never make one universal “Accept” button silently perform different dangerous actions;
- keep machine/discovery suggestions, private-research candidates and community submissions subject to the same review boundary.

The constitutional rule remains: suggestions can propose civic knowledge; they must not silently rewrite or become reviewed knowledge without an explicit human decision.

## Phase 8 — Sustainable automation, search and resilience

**Status: partly live; ongoing**

Already automated:

- combined feed aggregation across RSS/Atom, video, filtered broad-area sources, monitored public pages and official-source adapters;
- scheduled email delivery;
- scheduled civic-item archiving;
- browsable persistent Civic Archive;
- research exports and public graph rebuilds after curated changes;
- entity descriptions exported from curated research notes;
- source-health collection with public-friendly status language;
- detailed transport/fetch diagnostics hidden from ordinary readers but available through `?debug=1` for troubleshooting;
- bridge/adaptor patterns for external sources that block or distort normal server-side access.

Next:

- scalable/sharded archive indexing rather than scanning the whole canonical store indefinitely;
- stronger feed caching and parser regression tests;
- registry-driven source configuration and safer source lifecycle handling;
- better private source-health review tooling and alerts;
- searchable/grouped source facets as the source universe grows;
- automated completeness checks for public entities and provider/source links;
- safer refresh/version handling across research and live civic items;
- operational monitoring as the source set grows.

## Public presentation and town views

**Status: major v1 live**

The Commons now has a coherent borough identity plus town-specific presentation for Ealing, Acton, Greenford, Hanwell, Northolt, Perivale and Southall. Town marks and share cards are treated as presentation assets, while the civic data remains one Commons rather than seven duplicated sites. Southall can be entered through its dedicated Commons subdomain and town-scoped links can preserve a local view without severing navigation back to the wider borough Commons.

Still open:

- continue polishing town-specific landing/share behaviour where useful;
- keep town branding consistent without allowing presentation concerns to fork the underlying civic data model;
- review whether additional civic/local subdomains add genuine utility before creating them.

## Later / parallel — federation and external bridges

RSS.chat, ActivityPub, AT Protocol or other open social systems remain possible bridges, not core dependencies.

The Commons should preserve its own public URLs, source provenance, stable item/thread identities, subscriptions, reviewed contributions and civic relationships. External systems should be able to connect to those primitives without owning them.

## Immediate next slice

1. **Build Phase 7C promotion rules** for accepted source submissions and evidence suggestions first, then relationship suggestions.
2. **Connect accepted evidence to civic memory** — archived stories, Document Watch records, issues, entities and earlier reporting — without duplicating canonical source material.
3. **Improve archive/search indexing** so growth from dozens of sources to hundreds remains fast and complete rather than relying on whole-store scans.
4. **Make source filtering scale** with searchable/grouped publisher families as dozens of source identities become hundreds.
5. **Finish the public entity completeness audit** and automate checks for newly incomplete records.
6. **Harden and extend official-source ingestion** — especially direct ModernGov destinations, meeting/document relationships, parser tests, caching and preservation of high-value primary records.
7. **Continue deliberate source expansion and explore an OCN partnership/API arrangement in parallel.** The existing OCN and ModernGov bridges are sufficient for current coverage; neither is a blocker.

## Non-negotiable design boundaries

- Original publishers and official records remain canonical.
- Provenance stays visible, but public wording should be understandable without knowing the ingestion architecture.
- A bare name is not a finished civic entity.
- Historical and current organisations must be framed temporally rather than flattened together.
- Chronology is not replaced by engagement ranking.
- Participation and civic assertions are moderated rather than popularity-ranked.
- Private submitter details never become public by accident.
- No behavioural advertising.
- No compulsory closed-platform identity.
- The Commons must remain useful when any one external service is unavailable.

**Publish anywhere. Connect locally. Participate openly. Remember civically.**
