# Civic Commons source discovery register

This is a working register of potential public-interest sources for Southall & Ealing Civic Commons.

The aim is to grow source coverage deliberately rather than indiscriminately. A source should be useful for civic discovery, have a reasonably stable public identity, and preserve a canonical link back to the original publisher. Where possible, prefer RSS/Atom or another documented public feed over scraping.

Status values:

- `live` — currently ingested by Civic Commons.
- `verified` — useful source/channel confirmed; ingestion still to be wired.
- `needs-feed-discovery` — useful publisher confirmed but no stable machine-readable feed verified yet.
- `needs-local-filtering` — source is broader than Ealing/Southall and should be filtered before ingestion.
- `research` — promising lead requiring further checking.

## Live video / feed sources

| Source | Type | Status | Notes |
| --- | --- | --- | --- |
| Ealing Council | official record + YouTube | live | Council news/RSS, ModernGov and official YouTube video feed. |
| Southall Black Sisters | organisation / campaign + YouTube | live | Official YouTube channel added as a video source; website/news archive is also high-value. |
| London Assembly | official record + YouTube | live | Committee meetings, Mayor's Question Time and investigations; useful for Bassam Mahfouz and London-wide governance. |
| Ealing Transition | organisation / campaign | live | Website RSS already ingested. |

## High-priority verified sources

| Source | Type | Status | Why it matters / next action |
| --- | --- | --- | --- |
| The Monitoring Group | organisation / campaign | needs-feed-discovery | Long-running anti-racism, policing and state-accountability material with strong Southall history; site includes current articles and links to primary inquiry material/video. |
| Metropolitan Police — Ealing | official record | needs-local-filtering | Ealing neighbourhood policing pages and local social channels are valuable; avoid dumping all London crime news into Commons. Develop Ealing/ward filtering first. |
| Metropolitan Police YouTube | official video | needs-local-filtering | Official Met channel confirmed; ingest only when Ealing relevance can be determined reliably. |
| Ealing Friends of the Earth | organisation / campaign | needs-feed-discovery | Active local environment, air-pollution, climate and green-space campaigning. |
| Ealing Law Centre | legal / community organisation | needs-feed-discovery | Housing, immigration and welfare-rights work; potentially strong source material for housing and social-justice issues. |
| Ealing and Hounslow CVS (EHCVS) | voluntary-sector infrastructure | needs-feed-discovery | Community-sector news, networks, training and local voluntary-sector activity. |
| Warren Farm Nature Reserve | community / environment campaign | needs-feed-discovery | Rich archive of campaign material, evidence, meeting links and timestamps into Ealing Council video records. |
| London City Hall / GLA RSS | official record | verified | City Hall publishes documented RSS endpoints. Selected endpoints below are ready to wire into the main feed. |
| London Assembly ModernGov | official record | verified | Committee pages expose meeting documents; useful companion to Assembly video and City Hall RSS. |
| Bassam Mahfouz AM | elected representative | live graph / verified source | Canonical Commons entity and reviewed current Assembly roles now added; City Hall profile and Assembly records are the evidence sources. |

### Verified City Hall RSS endpoints selected for Commons

- London Assembly press releases — `https://www.london.gov.uk/rss-feeds/80611`
- London Assembly current investigations — `https://www.london.gov.uk/rss-feeds/80616`
- London Assembly publications — `https://www.london.gov.uk/rss-feeds/80633`
- Housing and land publications — `https://www.london.gov.uk/rss-feeds/80642`
- Planning publications — `https://www.london.gov.uk/rss-feeds/80643`
- Environment and Climate Change publications — `https://www.london.gov.uk/rss-feeds/80644`

These should be ingested as `Official record` sources and filtered/ranked for Ealing relevance where possible rather than allowed to dominate the local feed.

## Named community-source leads

| Source | Status | Notes |
| --- | --- | --- |
| Ealing Citizens / Citizens UK | research | Locate Ealing-specific news/video/feed endpoints and distinguish local chapter content from national Citizens UK material. |
| The Kings Centre Southall | research | Identify official website/news and YouTube/video sources; likely useful for local community, faith and social-action material. |
| Local churches and faith organisations | research | Add selectively where they publish civic/community work, consultations, food-bank/social-action activity or local public meetings; avoid treating routine worship content as civic news. |
| Friends of Victoria Hall | research | Locate current official publishing/feed/video surfaces; high relevance to civic assets, governance and heritage. |
| Other residents' associations and town groups | research | Prioritise groups with durable public archives and material tied to planning, environment, housing, transport or governance. |

## Source onboarding principles

1. Preserve the original publisher URL as canonical.
2. Distinguish `Official record`, `Journalism / publishing`, `Organisation / campaign`, `Community / faith`, and `Independent civic data / analysis` rather than flattening them into one trust category.
3. Video is a media type, not a separate evidential class: an official council video remains an `Official record`; an advocacy group's video remains `Organisation / campaign`.
4. Use titles/descriptions/transcripts for entity and topic discovery, but do not turn automatically detected relationships into reviewed assertions without human review.
5. Broad London/national sources should be filtered for Ealing/Southall relevance before entering the main feed.
6. Prefer stable RSS/Atom/API feeds. Scraping should be a last resort and should fail gracefully.
7. Captions/transcripts, where lawfully and technically available, should be treated as derived searchable text linked back to the canonical video — not as a replacement for the source.
