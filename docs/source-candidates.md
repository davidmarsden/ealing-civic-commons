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
| London City Hall / GLA selected RSS | official record | live, Ealing-filtered | Six documented City Hall RSS endpoints are consumed by `gla-feed.mjs`, filtered for explicit Ealing-area relevance and merged into the public combined feed. |
| Metropolitan Police — Ealing | official record | live, Ealing-filtered | Official newsroom plus Southall/Norwood Green Safer Neighbourhood priorities. |
| Metropolitan Police YouTube | official video | live, Ealing-filtered | Official YouTube Atom feed admitted only when title/description contains explicit Ealing/Southall/local ward terms. |
| Ealing Citizens / Citizens UK | organisation / campaign | live, Ealing-filtered | Dated West London Citizens news archive filtered for explicit Ealing/Southall relevance. |
| Ealing and Hounslow CVS (EHCVS) | voluntary-sector infrastructure | live page-watch | Dated Ealing community-services cards. |
| Warren Farm Nature Reserve | community / environment campaign | live page-watch | Stable blog permalinks and dates; strong FOI/video evidence material. |
| Ealing Friends of the Earth | organisation / campaign | live living-page watch | Current News section content-hashed; no dates invented. |
| The Monitoring Group | organisation / campaign | live living-page watch | The Drum living publication is content-hashed. |
| Ealing Transition | organisation / campaign | live | Website RSS already ingested. |
| Sri Guru Singh Sabha Southall | community / faith + YouTube | live, civic-filtered | Official YouTube channel filtered to lectures, community/interfaith/public-interest material; routine daily morning/evening livestreams suppressed. |
| Ealing Synagogue | community / faith | live civic page-watch | Dated first-party civic/interfaith/community material only. |
| St Anselm's Catholic Church Southall | community / faith | live civic page-watch | Dated parish-news material admitted only when it has a civic/community/interfaith hook. |
| St John's Southall Green | community / faith | live living-page watch | Community/outreach programme monitored; routine worship content is not used as civic news. |
| West London College | community / education | live, local civic-filtered | Dated college news admitted for explicit Ealing/Southall/public-interest relevance. |

## High-priority verified/reference sources

| Source | Type | Status | Why it matters / next action |
| --- | --- | --- | --- |
| Ealing Law Centre | legal / community organisation | verified reference source | Housing, immigration, welfare rights and social-justice material; seek a stable updates surface before live ingestion. |
| London Assembly ModernGov | official record | verified | Meeting documents; useful companion to Assembly video and City Hall RSS. |
| Bassam Mahfouz AM | elected representative | live graph / verified source | Current Assembly roles are reviewed graph evidence. |
| The Kings Centre Southall | community / faith | verified reference source | First-party identity/site confirmed; no durable current-news feed yet. |
| Guru Nanak Darbar Southall | community / faith | verified first-party source | First-party gurdwara site with media/kirtan resources; identify civic/community updates suitable for selective ingestion. |
| Jamia Masjid Islamic Centre Southall | community / faith | verified first-party source | Townsend Road mosque with first-party website; look for durable community/public-interest update surface. |
| Central Jamia Masjid Southall | community / faith | verified first-party source | First-party website/document trail confirmed; seek civic/community publishing surface. |
| Vishwa Hindu Kendra Mandir | community / faith | verified first-party source | First-party site with events/news and wider community/education role. |
| Shree Ram Mandir Southall | community / faith | verified first-party source | First-party site explicitly describes community service, interfaith work and major public cultural events. |
| Christ the Redeemer Church Southall | community / faith | verified entity/source lead | Ealing Citizens member institution; locate durable first-party civic/community publishing surface. |
| Villiers High School | community / education | verified source lead | Family bulletin has current local civic/policing material; investigate stable feed/watch. |

## Faith/community discovery inventory

Coverage should be plural by design. Current confirmed Southall/Ealing leads include:

- **Sikh:** Sri Guru Singh Sabha Southall; Gurdwara Guru Nanak Darbar Southall; Ramgarhia Sabha; Shri Guru Ravidas Sabha; Gurdwara Nanaksar; Miri Piri Sahib; Guru Amardass Ji.
- **Muslim:** Jamia Masjid Islamic Centre; Central Jamia Masjid; Abubakr Mosque / Islamic Educational & Recreational Institute; Darussalam Masjid & Cultural Centre.
- **Hindu:** Vishwa Hindu Kendra Mandir; Shree Ram Mandir; Baba Balaknathji Temple and other Southall Hindu institutions identified through community/faith directories and first-party verification where available.
- **Jewish:** Ealing United Synagogue / Ealing Synagogue, including civic and interfaith activity.
- **Christian:** St Anselm's; St John's Southall Green; Christ the Redeemer; The Kings Centre; plus other Southall churches where civic/community publishing is substantial.

The inclusion rule is **civic relevance, not theology**: routine worship/service notices are not automatically Commons items. Community organising, public meetings, interfaith work, social action, education, welfare, local campaigning, civic events and source material are in scope.

## Live City Hall RSS endpoints selected for Commons

- London Assembly press releases — `https://www.london.gov.uk/rss-feeds/80611`
- London Assembly current investigations — `https://www.london.gov.uk/rss-feeds/80616`
- London Assembly publications — `https://www.london.gov.uk/rss-feeds/80633`
- Housing and land publications — `https://www.london.gov.uk/rss-feeds/80642`
- Planning publications — `https://www.london.gov.uk/rss-feeds/80643`
- Environment and Climate Change publications — `https://www.london.gov.uk/rss-feeds/80644`

## Source onboarding principles

1. Preserve the original publisher URL as canonical.
2. Distinguish `Official record`, `Journalism / publishing`, `Organisation / campaign`, `Community / faith`, `Community / education`, and `Independent civic data / analysis` rather than flattening them into one trust category.
3. Video is a media type, not a separate evidential class.
4. Use titles/descriptions/transcripts for entity/topic discovery, but never convert automatically detected relationships into reviewed assertions without human review.
5. Broad London/national sources must be filtered for Ealing/Southall relevance.
6. Prefer stable RSS/Atom/API feeds; monitored pages must be explicit, conservative and fail closed.
7. Captions/transcripts may be derived searchable text but never replace the canonical video/source.
8. Third-party reporting is evidence about an organisation, not a substitute for that organisation's own source channel.
9. Faith/community sources are selected on civic/public-interest output, not religious tradition; apply the same rule consistently across faiths and non-faith civic institutions.
