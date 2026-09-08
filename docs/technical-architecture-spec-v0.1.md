# Ealing Civic Commons
## Technical Architecture & Implementation Notes — v0.1

**Updated:** 8 September 2026  
**Status:** Living architecture for the public prototype

This document began as the Phase 1 prototype specification. The implementation has moved well beyond the original read-only design, so this living v0.1 now records the architecture that is actually live while preserving the founding constraints.

## 1. Product proposition

Build an independent, open civic information layer connecting local publishing, official democratic records, planning/register data, public evidence and reviewed civic memory.

The system began in Southall but is designed for all seven towns in the London Borough of Ealing:

**Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.**

A borough-wide service must not assume that the priorities of those places are interchangeable.

The constitutional principle remains:

> The Commons connects sources; it does not absorb ownership of them.

That now applies not only to articles and feeds but also to official registers: Ealing Council PAM, ModernGov and other primary records remain canonical even when the Commons creates civic objects and relationships around them.

## 2. What the Commons is now

The live prototype is no longer just a read-only timeline. It now includes:

- source aggregation and provenance-rich chronological discovery;
- stable civic-item pages and persistent archive memory;
- moderated contributions and a durable review queue;
- browser follows, personal RSS and email alerts;
- Document Watch and official-source adapters;
- a reviewed people/organisation/place/topic/issue graph;
- a current planning-application discovery layer;
- explicit planning → place → issue relationships for the current snapshot;
- shared civic dossier pages that combine current material with deeper reviewed evidence/history.

It is still **not** intended to become a replacement publisher, council portal, engagement-ranking system or compulsory social network.

## 3. High-level architecture

```text
LOCAL / CIVIC / OFFICIAL SOURCES
RSS | Atom | public pages | official registers
                |
                v
+------------------------------------+
| SOURCE-SPECIFIC INGESTION/ADAPTERS |
| fetch -> parse -> validate -> cache |
+------------------+-----------------+
                   |
                   v
+------------------------------------------------+
|             CIVIC DATA / MEMORY LAYERS         |
| live feed snapshots     Netlify Blobs archive  |
| reviewed assertions     research exports       |
| latest planning snapshot public contributions  |
| review queue            entity/issue registry  |
+-----------------------+------------------------+
                        |
                        v
+------------------------------------------------+
|          NORMALISED CIVIC OBJECTS / GRAPH      |
| items | people | organisations | places        |
| topics | issues | planning applications        |
| documents | relationships | provenance         |
+-----------------------+------------------------+
                        |
                        v
+------------------------------------------------+
|               PUBLIC CIVIC COMMONS             |
| Latest | Archive | Planning | Explore           |
| entity dossiers | issue dossiers | Document     |
| Watch | follows | RSS | email | reviewed context|
+------------------------------------------------+
```

The implementation deliberately mixes live/dynamic services with committed/generated public snapshots when that improves reliability and reviewability.

## 4. Current implementation stack

The original specification proposed a future TypeScript/PostgreSQL application. The present prototype instead uses deliberately lightweight infrastructure:

- static/public HTML/CSS/JavaScript;
- Netlify hosting, Functions and Edge Functions;
- Netlify Blobs for persistent civic-item/review/archive state;
- scheduled GitHub Actions/Netlify workflows where appropriate;
- repository-committed registries, reviewed rules and generated snapshots;
- Resend for double-opt-in email delivery;
- Node scripts for validation, ingestion, generation and source diagnostics.

This is a prototype architecture, not a commitment that PostgreSQL or a server-rendered framework will never be appropriate later. The priority remains portability, inspectability and avoiding infrastructure that outruns the civic use case.

## 5. Core civic object model

### Sources

Source identity includes homepage/feed/adapter information, source class, geography/topic defaults, operational status and provenance.

### Civic items

Normalised article/event/document items keep stable Commons identities while the original publisher URL remains canonical.

### People, organisations and places

Public civic entities have stable IDs/routes, type, description, useful aliases, provenance and an authoritative/first-party source where one exists.

A bare name is not considered a complete public entity.

### Topics and issues

Topics group recurring civic themes. Issues represent durable civic questions that can connect current material, entities, evidence, historical reporting and planning context.

An issue may have an explicit reviewed `primaryEntityId`. This is used for relationships such as issue → primary place → current planning records rather than relying on fuzzy name matching.

### Planning applications

Planning applications are currently exposed as first-class **current civic records** from the latest validated planning snapshot. The conservative public object contains:

- application reference;
- address/site;
- proposal;
- status;
- validated date;
- deterministic category where useful;
- conservatively classified town where available;
- out-of-borough flag;
- authoritative PAM URL;
- Commons route for the record while it is present in the published snapshot;
- explicit `place_links[]` with provenance.

Planning applicant/agent contact data, documents, drawings and mapping tiles are not mirrored merely because they are visible in a public register.

**Current limitation:** the published planning dataset is a latest-week snapshot, not yet a persistent planning archive. When a later successful refresh replaces `planning-latest.json`, applications from the previous week are no longer available through the current planning, place or issue views unless they also appear in the new snapshot. Durable planning history is therefore a next-step capability, not a live one.

### Relationships

Relationships remain explicit graph edges with source/review provenance.

Useful examples now include:

- civic item `about` place;
- organisation `developer_of` place;
- official record `belongs_to` meeting;
- planning application `located_in` town;
- planning application `planning_at` specific reviewed place;
- issue `has_primary_entity` place;
- historical reporting `about` issue/place.

## 6. Planning ingestion architecture

Ealing Council PAM / Civica Public Access is authoritative for live Ealing planning applications.

The ingestion path is intentionally **not** part of each public page request and **not** a dependency of the Netlify site build.

Current flow:

1. GET the live PAM weekly-list form;
2. preserve hidden/default fields, CSRF and session state;
3. select the latest completed local week using `Europe/London` calendar boundaries;
4. submit the exact live form payload;
5. paginate through all weekly results;
6. fetch application summaries at low rate;
7. normalize and validate factual fields;
8. fail closed if any discovered application could not be published safely/completely;
9. generate a committed **latest-week** public planning snapshot;
10. propose snapshot changes through the repository workflow.

This means the public Commons can remain available during PAM downtime and a partial refresh cannot silently replace the last complete public state. It does **not** yet mean older planning records are retained after the next successful refresh.

## 7. Planning place-link provenance

The planning layer deliberately distinguishes two relationship classes:

### `town-classification`

Generated only from conservative deterministic address/place classification.

### `reviewed-rule`

A deliberate, inspectable rule for a specific site relationship. It may carry a rule ID and reviewer-facing note.

The first live example is application `263308CND` at 2 The Straight, linked in the current snapshot to:

- `places/southall` — town classification;
- `places/southall-gasworks` — reviewed site rule.

The Southall Gasworks redevelopment issue then inherits that current planning context through its reviewed primary-place relationship.

This is preferable to fuzzy text matching because it keeps civic context inspectable and correctable.

## 8. Place as durable civic memory

PAM thinks in applications; residents often think in **places**.

Civic Commons therefore treats the **place** as the durable civic object. A place dossier can accumulate:

- current reviewed civic facts;
- local/public data evidence;
- recent Commons material;
- current planning applications from the latest published snapshot;
- primary evidence;
- historical reporting;
- reviewed relationships.

The place persists even when a current planning record drops out of the latest-week snapshot. Retaining prior planning records so that planning itself becomes part of durable place history is planned work and should not be confused with the persistence already provided by the place/entity layer.

The same place can connect to one or more durable civic issues.

## 9. Civic dossier presentation

People, organisation, place and issue pages use a common dossier-card presentation.

The page presents current context before research depth. Visible section navigation is generated in exactly the same order as the rendered cards.

For entity/place pages the canonical order is:

1. Current civic facts;
2. Local evidence (where available);
3. Current Commons;
4. Planning register (where available);
5. Primary evidence;
6. Historical reporting;
7. Reviewed connections.

Issue pages use the equivalent current → planning → evidence → history → connections → participants sequence.

Cards are keyboard-accessible, clickable, deep-linkable and can start collapsed where the content is research-heavy. All people, organisation and place routes use one canonical civic-entity template to prevent per-entity presentation drift.

## 10. Provenance classes

The UI should continue to distinguish:

1. Official record
2. Independent structured information
3. Journalism / publishing
4. Organisation / campaign
5. Community contribution
6. Commons-generated/reviewed enrichment

Every transformed field or relationship should retain enough provenance to explain where it came from and how it was promoted.

## 11. Geographic classification

Use layers in this order:

1. source/register metadata;
2. deterministic town/ward/postcode/place matching;
3. structured provider metadata;
4. reviewed explicit relationships;
5. machine-assisted suggestions only where genuinely useful.

Do not let fuzzy classification silently become reviewed civic knowledge.

## 12. Relationship matching

High-confidence deterministic signals can be used directly when the relationship is objectively encoded. Specific civic-memory relationships should otherwise be reviewed.

Useful signals include:

- official identifiers/references;
- exact canonical URLs;
- development/site names;
- meeting/committee names;
- documents and decision references;
- reviewed place rules;
- named entities plus geography/topic/date context.

Machine/fuzzy matches should remain suggestions until reviewed unless their status is explicitly communicated as uncertain.

## 13. Archive and persistence

The Civic Archive is backed by persistent normalised item snapshots rather than an arbitrary feed-history window.

A stable item can therefore survive the original RSS item ageing out. Reviewed contribution activity can reactivate an old civic thread while preserving the source's original publication date.

Planning currently uses a different and more limited persistence strategy: a validated committed **latest-week snapshot**. The current record route and its place/issue appearances therefore last only while that record remains in `planning-latest.json`. Historical planning retention/backfill should be added only with clear update/version semantics and appropriate rate/licensing boundaries.

## 14. Review boundary

Community submissions, source discoveries, evidence suggestions, relationship suggestions and machine-generated candidates all sit on the proposal side of a review membrane.

The constitutional rule remains:

> Suggestions can propose civic knowledge; they do not silently become reviewed civic knowledge.

Deterministic factual ingestion from an authoritative register is different from reviewed graph interpretation, but publication still requires validation and safe field minimisation.

## 15. Open outputs and portability

The Commons exposes or is designed to expose:

- main and filtered RSS;
- personal RSS;
- source lists/OPML;
- stable civic item/entity URLs;
- planning record routes for records in the current published snapshot;
- portable public metadata/JSON where useful;
- repository-visible registries/rules/documentation.

The Commons must not become another silo.

## 16. Security and privacy

- sanitise inbound HTML;
- SSRF protection and bounded fetches;
- source allowlists/controlled adapters;
- minimal personal data;
- review/admin audit trail;
- no behavioural advertising;
- no compulsory closed-platform identity;
- keep private submission data separate from public civic records;
- do not create civic profiles for private planning applicants merely because a name occurs in a public register.

## 17. Copyright and official-register respect

Store/publish factual metadata, reasonable discovery excerpts, supplied descriptions and links by default.

Do not assume feeds or public-register pages grant permission to mirror copyrighted articles, planning drawings, documents or third-party mapping material.

Primary publishers/registers remain canonical.

## 18. Accessibility

Target WCAG 2.2 AA. Dossier cards and section navigation must remain keyboard accessible, deep-linkable, zoom/reflow friendly and understandable without relying on visual styling alone.

## 19. Resilience / observability

Track:

- source health and stale feeds;
- parser/fetch failures;
- duplicate civic items;
- archive health;
- planning ingest completeness;
- generated snapshot freshness;
- provider/API failures;
- broken canonical links;
- incomplete public entities.

One failing upstream must not break the public Commons.

## 20. Near-term architectural work

1. **Persist planning records across refreshes** before describing planning itself as durable civic memory.
2. Add planning decision/status history and reliable ward/site geography.
3. Link retained planning records to committee/decision/document/reporting context where deterministic or reviewed.
4. Improve archive/search indexing as persistent memory grows.
5. Complete Phase 7C structured promotion for sources/evidence/relationships.
6. Automate public entity completeness checks.
7. Harden source adapters/parser tests/caching without creating one-service dependencies.
8. Restore town-aware social metadata generation for stable public routes.

## 21. Founding architectural principles

- Southall first, but borough-portable.
- Treat the seven towns as distinct civic geographies.
- Southall Stories is a founder/participant, not owner of the ecosystem.
- Provenance beats seamless-looking synthesis.
- Primary records beat AI summaries.
- Places are durable civic memory, not merely text tags.
- Current planning context must not be described as persistent planning history until records survive weekly refreshes.
- Official registers remain canonical even when the Commons adds civic context.
- Open outputs as well as open inputs.
- No dependency on Facebook, Bluesky, RSS.chat, OCN, PAM availability or any single platform/service for the Commons to remain useful.
- Conversation/federation remains a replaceable layer.
- Prefer simple, inspectable infrastructure over premature scale engineering.
