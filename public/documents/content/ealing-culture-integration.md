# Ealing Culture integration

**Updated:** 9 September 2026  
**Status:** Live source integration

Ealing Culture is an official London Borough of Ealing cultural source at <https://ealingculture.org/>. Civic Commons integrates it through the public WordPress REST API, but deliberately does **not** recreate Ealing Culture's own “What’s on?” or creatives-directory experience.

## What is live

The source exposes structured WordPress collections for:

- `news`
- `event`
- `venue`
- `creative`

and associated taxonomies for audience, event type, news category, town/location, venue type/suitability and creative categories/business types.

The Civic Commons adapter:

- treats Ealing Culture as an **official source**;
- surfaces Ealing Culture news as attributed civic-timeline items;
- surfaces only events with explicit civic/community relevance rather than all listings;
- keeps Ealing Culture source health visible;
- preserves the original Ealing Culture page as canonical;
- retains venue and creative collections as reference data for future civic-graph/entity matching rather than publishing them as Commons directories;
- never auto-promotes Creative Directory entries into civic person profiles.

## Why events are filtered

Ealing Culture contains useful civic material alongside ordinary entertainment and listings. The Commons is intended to help answer **“What’s happening to Ealing?”**, not to become a generic “What’s on?” service.

Events therefore require explicit civic/community signals such as public art, libraries, heritage/local history, community activity, consultation/regeneration, green space, youth/schools, accessibility or inclusion. This filter is intentionally conservative and should be tuned from observed live results.

Some borderline items will remain. The operational rule is to keep the source useful without allowing cultural listings to overwhelm the main civic timeline.

## Geography semantics

Three different concepts must remain separate:

- **All Ealing** — a viewer-level choice meaning “do not filter the timeline by town”. It is not source metadata.
- **Boroughwide** — publisher metadata meaning an item applies across the borough.
- **Park Royal** — source geography that crosses borough boundaries. It is not an eighth Ealing town.

The seven Commons town identities remain Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall.

## Reference data and civic profiles

Venue and creative records are useful because they can later enrich places, organisations, issues and reviewed relationships. They are not, by themselves, reviewed civic entities.

A Creative Directory entry can therefore be retained as reference evidence without automatically creating a public person profile. Any later promotion into the civic graph must follow the same minimisation, provenance and review rules as other entity creation.

## Resilience

Taxonomy or reference-collection failures degrade to warnings rather than taking down the required news/event path. Required news/event collection failures remain visible through source health.

The adapter uses WordPress REST rather than brittle page scraping. The WordPress sitemap can be used as a completeness check, but the REST collections are the primary structured ingestion route.

## Monitoring / next steps

- watch which event types actually enter the main feed and tighten/relax the civic filter from evidence;
- keep venue/creative references out of public directories unless a clear Commons use case emerges;
- connect useful venue/place references into the civic graph only through reviewed/deterministic relationships;
- watch upstream WordPress schema/taxonomy changes and transient REST failures;
- consider cross-source relationships where Ealing Culture news connects to independent reporting or existing civic issues, rather than creating duplicate civic records.
