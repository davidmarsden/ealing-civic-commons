# Ealing Council Document Watch

**Status:** first working model  
**Date:** 29 August 2026

Ealing Council publishes a large number of RSS feeds for document-download collections. These feeds are separate from council news RSS and from the formal ModernGov democratic record.

## Why this matters

A document feed can expose primary material — budgets, policies, contracts, housing performance, air-quality reports, Local Plan documents and other records — even when the material is difficult to discover through the council website navigation.

Civic Commons treats these as **official primary-source publishing signals**, not as editorial news.

## Registry

`public/data/ealing-council-downloads.json` records every document-download RSS feed discovered from the council sitemap on 29 August 2026.

The registry deliberately keeps feeds that appear dormant or historical. A stale feed is still useful evidence about the council's information architecture; it should not silently disappear simply because it no longer publishes regularly.

Known historical examples are marked with `statusHint` rather than presented as current.

## Live Document Watch

The first live subset favours document streams with high civic-accountability value:

- council and local decisions;
- budgets and spending;
- strategies, plans and policies;
- climate action;
- tenders and contracts;
- Local Government Pension Scheme;
- housing, housing performance and housing regeneration;
- pollution and air quality;
- planning policy and Local Plan;
- Our neighbourhoods;
- rubbish and recycling;
- transport strategies and plans.

These feeds are fetched in parallel and normalized as one timeline source: **Ealing Council — Document Watch**.

Each item retains the originating council category, canonical document URL, publication date, Civic Commons topics and provenance marker `Ealing Council document RSS`.

## Freshness

For enabled feeds the ingestion diagnostics calculate a simple freshness state from the newest dated item returned:

- `active` — activity within roughly six months;
- `quiet` — last activity between six months and two years;
- `historical` — last activity more than two years ago;
- `empty` — feed fetched successfully but returned no dated items;
- `unavailable` — the feed could not be fetched on that request.

Freshness is descriptive, not a judgement of importance or legal status.

## Deduplication and persistence

Items are deduplicated by canonical URL across enabled document feeds before entering the Civic Commons timeline. Once normalized, they use the same persistent civic-item storage added in PR #25, so an item can remain available after it drops out of the council RSS window.

The original Ealing Council document remains canonical. Civic Commons stores normalized metadata and excerpts, not full copies of publisher documents.

## Next steps

Later iterations can:

- enable additional feeds after reviewing their real activity;
- expose per-feed health/freshness in the public source-health UI;
- connect documents to reporting, places, organisations and democratic events;
- add archive queries by topic/place/source without changing stable item identities;
- preserve historically important but dormant council feeds as part of the civic information record.
