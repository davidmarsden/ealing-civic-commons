# Southall & Ealing Civic Commons
## Technical Architecture & Prototype Specification — v0.1

**Date:** 26 August 2026  
**Status:** Proposed architecture for partner review and Phase 1 implementation

## 1. Product proposition

Build an independent, open civic information layer connecting local publishing, official democratic records, structured council data and — later — community conversation.

The system begins in Southall but is designed for all seven towns in the London Borough of Ealing:

**Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.**

A future borough-wide service should not assume that the priorities of **Ealing, Southall, Greenford, Acton, Northolt, Perivale or Hanwell are interchangeable**.

The architecture must preserve one constitutional principle above all:

> The Commons connects sources; it does not absorb ownership of them.

## 2. Phase 1 non-goals

The first prototype is not:

- a social network;
- a replacement publishing platform;
- a comment system;
- a council portal;
- an engagement-ranking algorithm;
- an AI newsroom;
- a comprehensive archive.

It is a trustworthy read-only civic timeline with excellent provenance.

## 3. High-level architecture

```text
LOCAL PUBLISHERS / ORGANISATIONS
RSS / Atom / JSON Feed
        |
        v
+-------------------------+
| Feed ingestion workers  |
| fetch -> parse -> dedupe |
+------------+------------+
             |
             v
+----------------------------------+
|        CIVIC DATA STORE          |
| sources        items             |
| organisations  places            |
| topics         people            |
| meetings       documents         |
| relationships  provenance        |
+---------+------------------------+
          ^
          |
+---------+------------------------+
| OFFICIAL / STRUCTURED DEMOCRACY  |
| Ealing ModernGov RSS + links     |
| Open Council Network API         |
+----------------------------------+
          |
          v
+----------------------------------+
| ENRICHMENT / MATCHING            |
| geography | topics | entities    |
| meeting/article relationships    |
| optional AI-assisted summaries   |
+----------------+-----------------+
                 |
                 v
+----------------------------------+
| PUBLIC WEB / OPEN OUTPUTS        |
| latest | town | topic | meeting  |
| source pages | evidence links    |
| RSS/Atom | OPML | JSON API       |
+----------------------------------+

Future optional edge:
RSS.chat / another open conversation protocol
```

## 4. Core data model

### `sources`
- `id`
- `slug`
- `name`
- `homepage_url`
- `feed_url`
- `source_type`
- `publisher_type`
- `default_geographies[]`
- `default_topics[]`
- `is_official`
- `is_active`
- `poll_interval`
- `last_fetch_at`
- `last_success_at`
- `failure_count`
- `terms_notes`
- timestamps

### `items`
- `id`
- `source_id`
- `external_id`
- `canonical_url`
- `title`
- `author`
- `published_at`
- `updated_at_source`
- `summary_original`
- `content_excerpt`
- `raw_metadata`
- `ingested_at`
- `content_hash`
- `status`

Use `(source_id, external_id)` as the primary dedupe key where a stable GUID exists, with canonical URL/content hash fallbacks.

### `geographies`
Begin with:
- Borough: Ealing
- Towns: Acton, Ealing, Greenford, Hanwell, Northolt, Perivale, Southall
- Wards
- neighbourhoods/estates later

### `topics`
Initial controlled vocabulary:
- Council & democracy
- Planning & development
- Housing
- Environment
- Transport
- Community
- Schools & young people
- Policing & safety
- Health & care
- Culture & history
- What's on

### `civic_events`
Normalised democratic events:
- provider/external ID
- authority
- committee
- event type
- title
- date/time
- official URL
- provider URL
- status
- raw metadata

### `documents`
Documents linked to civic events, preserving official/provider URLs and identifiers.

### `relationships`
Generic graph edge:
- `from_type`, `from_id`
- `to_type`, `to_id`
- `relationship_type`
- `confidence`
- `created_by` (`source`, `rule`, `model`, `human`)
- `review_status`

Examples:
- article `covers` meeting
- document `belongs_to` meeting
- item `about` topic
- item `about` place
- historical item `precedes` current issue

## 5. Provenance

The UI must distinguish:

1. Official record
2. Independent structured information
3. Journalism / publishing
4. Organisation / campaign
5. Community contribution
6. Commons-generated enrichment

Every transformed/generated field should retain source IDs and transformation provenance.

## 6. Feed ingestion

Support RSS 2.0 and Atom first; add JSON Feed when useful.

Process:
1. conditional HTTP fetch;
2. parse;
3. normalise dates/URLs;
4. dedupe;
5. store;
6. attach source defaults;
7. queue enrichment;
8. log health/errors.

Sanitise inbound HTML. Prefer excerpts + canonical links rather than full-text republication unless permission allows it.

## 7. Ealing ModernGov

Initial integration:
- ingest `https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0`;
- classify item/event type;
- preserve official links;
- fetch individual public pages only where needed for metadata/matching.

ModernGov remains the primary official source where interpretation differs.

## 8. Open Council Network

Preferred model: partnership/API.

Confirm before production:
- authentication;
- endpoint catalogue;
- price/pilot terms;
- rate limits;
- licensing/reuse;
- attribution;
- stable identifiers;
- update/deletion semantics;
- meetings/documents/people/committee schemas;
- which fields are AI-generated or AI-assisted.

OCN should enrich, not replace, primary official records.

## 9. Geographic classification

Use four layers:
1. source defaults;
2. deterministic matching (town/ward/postcode/place);
3. structured provider metadata;
4. machine-assisted classification only where necessary.

Store evidence/confidence and support correction.

## 10. Topic classification

Prefer source tags/categories and deterministic rules first. Machine classification may suggest topics but should not silently overwrite source categorisation.

## 11. Relationship matching

Signals:
- direct official/OCN URL;
- planning/licensing/application identifier;
- meeting/committee names;
- development/site name;
- document title;
- date proximity;
- named people/organisations;
- geography + topic.

Deterministic high-confidence matches may publish automatically. Fuzzy/AI matches should initially require review or be labelled "possibly related".

## 12. Phase 1 public routes

- `/`
- `/southall` and later other towns
- `/topics/{topic}`
- `/sources/{source}`
- `/items/{id}`
- `/meetings/{id}` (Phase 2)
- `/about`
- `/charter`
- `/sources`

Every item card shows source, source class, title, date, excerpt/summary, geography/topic and a clear **Read original** link.

Default ordering is chronological, not engagement-ranked.

## 13. Open outputs

Expose:
- RSS/Atom for latest;
- per-town feeds;
- per-topic feeds;
- optional per-source feeds;
- OPML source lists;
- documented read-only JSON API later.

The aggregator must not become another silo.

## 14. Search

Start with PostgreSQL full-text search. Semantic/vector search is optional later.

## 15. Suggested stack

Keep it boring and portable:
- TypeScript
- server-rendered React framework
- PostgreSQL
- scheduled workers/functions
- managed hosting
- public repo where practical

Version-control schema, source register, charter, parsers/tests and technical decisions.

## 16. Security/privacy

- sanitise inbound HTML;
- SSRF protection;
- source allowlist;
- fetch timeouts/size limits;
- privacy-preserving analytics;
- no behavioural advertising;
- minimal personal data;
- admin audit trail;
- future rate-limiting for submissions.

## 17. Copyright/publisher respect

Store metadata, reasonable discovery excerpts, supplied descriptions and links by default.

Do not assume an RSS feed grants permission to republish full copyrighted articles.

Provide publisher correction/opt-out routes.

## 18. Accessibility

Target WCAG 2.2 AA: keyboard access, semantic landmarks, contrast, zoom/reflow, screen-reader labels, accessible dates/times and plain-language source labels.

## 19. Observability

Track feed health, stale sources, parsing failures, duplicates, enrichment confidence, broken links and API quota status.

## 20. Development phases

**Phase 0:** governance, source census, partner conversations  
**Phase 1:** read-only Southall prototype  
**Phase 2:** structured democracy / OCN integration  
**Phase 3:** town/topic/committee subscriptions and email digests  
**Phase 4:** open conversation layer  
**Phase 5:** civic memory and archives

## 21. MVP acceptance criteria

1. At least eight independent/official feeds ingest reliably.
2. Every item has clear source attribution and canonical link.
3. Southall filtering has low obvious false positives.
4. Official records are visually distinct from commentary.
5. Duplicate items are controlled.
6. One failing source cannot break the timeline.
7. The Commons exposes its own RSS feed.
8. No closed social network is required.
9. The interface makes sense to non-RSS users.
10. Test users discover useful local information they would otherwise have missed.

## 22. Questions for Open Council Network

1. Could Ealing be supported as a public-interest pilot/development partnership?
2. Which entities and stable identifiers are available?
3. Can we retrieve meetings, committees, documents, people/attendees and topics?
4. How are corrections and updates represented?
5. Which fields are AI-generated or AI-assisted?
6. What attribution is required?
7. What caching is permitted?
8. Are derived links/classifications permitted?
9. What rate limits should we design for?
10. Could lessons/code from the pilot be reused by other communities?
11. Is OCN interested in co-designing a neighbourhood-level use case distinct from its national interface?

## 23. Founding architectural principles

- Southall first, but borough-portable.
- Treat the seven towns as distinct civic geographies.
- Southall Stories is a founder/participant, not owner of the ecosystem.
- Provenance beats seamless-looking synthesis.
- Primary records beat AI summaries.
- Open outputs as well as open inputs.
- No dependency on Facebook, Bluesky, RSS.chat or any single platform.
- Conversation is a later, replaceable layer.
- Prefer simple portable infrastructure over premature scale engineering.
