# Civic Commons source discovery register

This is a working register of potential public-interest sources for Southall & Ealing Civic Commons.

The aim is to grow source coverage deliberately rather than indiscriminately. A source should be useful for civic discovery, have a reasonably stable public identity, and preserve a canonical link back to the original publisher. Where possible, prefer RSS/Atom or another documented public feed over scraping.

Status values:

- `live` — currently ingested by Civic Commons.
- `verified` — useful source/channel confirmed; ingestion still to be wired.
- `page-watch candidate` — no advertised feed found, but a stable public news/blog page is structured enough for a cautious monitored-page adapter.
- `needs-local-filtering` — source is broader than Ealing/Southall and should be filtered before ingestion.
- `research` — promising lead requiring further checking.

## Live video / feed sources

| Source | Type | Status | Notes |
| --- | --- | --- | --- |
| Ealing Council | official record + YouTube | live | Council news/RSS, ModernGov and official YouTube video feed. |
| Southall Black Sisters | organisation / campaign + YouTube | live | Official YouTube channel added as a video source; website/news archive is also high-value. |
| London Assembly | official record + YouTube | live | Committee meetings, Mayor's Question Time and investigations; useful for Bassam Mahfouz and London-wide governance. |
| London City Hall / GLA selected RSS | official record | live, Ealing-filtered archive | Six documented City Hall RSS endpoints are consumed by `gla-feed.mjs`, filtered for explicit Ealing-area relevance, merged by `combined-feed.mjs`, and archived every 15 minutes. |
| Ealing Transition | organisation / campaign | live | Website RSS already ingested. |

## High-priority verified sources

| Source | Type | Status | Why it matters / next action |
| --- | --- | --- | --- |
| The Monitoring Group | organisation / campaign | page-watch candidate | Long-running anti-racism, policing and state-accountability material with deep Southall history. Current site includes new articles plus direct primary-source links to the Undercover Policing Inquiry, hearing transcripts and video evidence. No advertised RSS/feed found in the public page sweep. |
| Metropolitan Police — Ealing | official record | needs-local-filtering | Ealing neighbourhood policing pages and local channels are valuable; avoid dumping all London crime news into Commons. Develop Ealing/ward filtering first. |
| Metropolitan Police YouTube | official video | needs-local-filtering | Official Met channel confirmed; ingest only when Ealing relevance can be determined reliably. |
| Ealing Friends of the Earth | organisation / campaign | page-watch candidate | Active Ealing-specific environment source with current material on climate, clean air, green space, Heathrow and Park Royal/data-centre development. Public site does not advertise RSS in the current sweep. |
| Ealing Law Centre | legal / community organisation | verified reference source | High-value housing, immigration, welfare-rights and access-to-justice source. Publishing cadence is lower and there is no obvious current news feed, so treat primarily as an entity/reference source unless a stable updates endpoint emerges. |
| Ealing and Hounslow CVS (EHCVS) | voluntary-sector infrastructure | page-watch candidate | Very active Ealing news surface with dated items and excerpts, including Southall community activity, HMO licensing, Smoke-Free Ealing and voluntary-sector opportunities. No advertised RSS found; strong pilot for a cautious structured-page adapter. |
| Warren Farm Nature Reserve | community / environment campaign | page-watch candidate | Rich campaign/evidence archive, including FOI-based reporting and posts that link directly to Ealing Council meeting videos with useful timestamps. No advertised feed found in current sweep. |
| London Assembly ModernGov | official record | verified | Committee pages expose meeting documents; useful companion to Assembly video and City Hall RSS. |
| Bassam Mahfouz AM | elected representative | live graph / verified source | Canonical Commons entity and reviewed current Assembly roles added; City Hall profile and Assembly records are the evidence sources. |

### Live City Hall RSS endpoints selected for Commons

- London Assembly press releases — `https://www.london.gov.uk/rss-feeds/80611`
- London Assembly current investigations — `https://www.london.gov.uk/rss-feeds/80616`
- London Assembly publications — `https://www.london.gov.uk/rss-feeds/80633`
- Housing and land publications — `https://www.london.gov.uk/rss-feeds/80642`
- Planning publications — `https://www.london.gov.uk/rss-feeds/80643`
- Environment and Climate Change publications — `https://www.london.gov.uk/rss-feeds/80644`

`gla-feed.mjs` accepts an item only when its title/description contains an explicit local hook: Ealing, one of the seven towns, Ealing & Hillingdon/Bassam Mahfouz, Heathrow, OPDC/Old Oak, Warren Farm, the Green Quarter or Southall Gasworks. The filtered output is merged with local feeds by `combined-feed.mjs` and included in the scheduled item archive. This deliberately favours precision over recall so City Hall cannot swamp the local corpus.

## Named community-source leads

| Source | Status | Notes |
| --- | --- | --- |
| Ealing Citizens / Citizens UK | research | EHCVS currently carries Ealing Citizens' Tribunal material; locate the local chapter's own durable publishing/video surface before direct ingestion. |
| The Kings Centre Southall | research | Identify official website/news and YouTube/video sources; likely useful for local community, faith and social-action material. |
| Local churches and faith organisations | research | Add selectively where they publish civic/community work, consultations, food-bank/social-action activity or local public meetings; avoid treating routine worship content as civic news. |
| Friends of Victoria Hall | verified organisation / research source | ModernGov and local reporting establish the group and its role in the Victoria Hall litigation/campaign. A dedicated durable publishing surface has not yet been confirmed; continue source discovery rather than ingesting third-party coverage as if it were the group's own feed. |
| Other residents' associations and town groups | research | Prioritise groups with durable public archives and material tied to planning, environment, housing, transport or governance. |

## Source onboarding principles

1. Preserve the original publisher URL as canonical.
2. Distinguish `Official record`, `Journalism / publishing`, `Organisation / campaign`, `Community / faith`, and `Independent civic data / analysis` rather than flattening them into one trust category.
3. Video is a media type, not a separate evidential class: an official council video remains an `Official record`; an advocacy group's video remains `Organisation / campaign`.
4. Use titles/descriptions/transcripts for entity and topic discovery, but do not turn automatically detected relationships into reviewed assertions without human review.
5. Broad London/national sources should be filtered for Ealing/Southall relevance before entering the main feed/archive.
6. Prefer stable RSS/Atom/API feeds. Structured-page watching is acceptable where no feed is advertised, but should be explicit, conservative and fail gracefully.
7. Captions/transcripts, where lawfully and technically available, should be treated as derived searchable text linked back to the canonical video — not as a replacement for the source.
8. A third-party article about an organisation is evidence about that organisation, not a substitute for the organisation's own source channel.
