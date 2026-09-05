# Southall & Ealing Civic Commons
## Source Register — v0.4

**Date:** 6 September 2026  
**Status:** Audited operational register plus borough civic-source census  
**Coverage:** Ealing's seven distinct towns/areas — **Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall**.

This version fixes an ambiguity in v0.3. The previous register used one status column for several different things: whether a source had been discovered, whether a usable feed/page had been verified, and whether Civic Commons was actually ingesting it. Those are now separated.

The implementation code and public source-health output are authoritative for **live ingestion**. This document is the human-readable register.

### Status model

- **INGESTING** — configured in the live Civic Commons aggregation path. A source may still be temporarily unhealthy upstream; operational health is reported separately.
- **VERIFIED** — a usable first-party feed or public-page integration has been checked, but the source is not currently configured for live ingestion.
- **CANDIDATE** — plausible source or endpoint discovered; still requires technical/editorial verification.
- **PARTNER** — valuable current source where a direct relationship or publishing bridge is preferable to scraping.
- **REFERENCE** — useful organisation, dataset or civic context source, but not a routine timeline publisher.
- **SOCIAL-ONLY** — primarily available through Facebook/X/Ning or similar closed/social publishing; do not depend on it as core infrastructure.
- **STALE/HISTORIC** — useful for civic memory but not dependable as a current source.
- **CHECK** — current publishing status still needs investigation.

`INGESTING` describes configuration, not a guarantee that an upstream site is healthy at every request. Source-health diagnostics exist precisely because live publishers can fail, block automation or change format.

---

# 1. Audited live source set

The following sources are confirmed in the current live aggregation path or a dedicated adapter invoked by it.

| Source | Geography | Type | Integration | Status |
|---|---|---|---|---|
| Southall Stories | Southall | Independent journalism | Native RSS / Micro.blog | **INGESTING** |
| Community Powered Reporting | Southall | Community journalism | Native RSS | **INGESTING** |
| The Neighbours’ Paper | Borough-wide | Local publication | Native RSS: `https://neighbourspaper.org/feed/` | **INGESTING** |
| Southall Residents Alliance | Southall | Residents / campaign | Native RSS | **INGESTING** |
| Southall Transition | Southall | Community / sustainability | Native RSS | **INGESTING** |
| Ealing Matters | Borough-wide | Civic alliance | Native RSS | **INGESTING** |
| Ealing Civic Society | Borough-wide | Civic / conservation / planning | Native WordPress RSS | **INGESTING** |
| West Ealing Neighbours | Ealing | Community publisher | Native RSS | **INGESTING** |
| Ealing Transition | Ealing | Sustainability / community | Native RSS | **INGESTING** |
| East Acton Golf Links Residents’ Association | Acton | Residents / planning | WordPress RSS | **INGESTING** |
| Ealing Council — ModernGov | Borough-wide | Official democratic record | Official RSS transported through a public feed-reader bridge because direct server-to-server access is blocked | **INGESTING** |
| Ealing Council — News | Borough-wide | Official publishing | Official council RSS, with category feeds used for topic enrichment | **INGESTING** |
| Ealing Council — YouTube | Borough-wide | Official publishing / video | YouTube Atom | **INGESTING** |
| Southall Black Sisters — YouTube | Southall | Organisation / campaign / video | YouTube Atom | **INGESTING** |
| London Assembly — YouTube | Borough-wide relevance | Official publishing / video | YouTube Atom | **INGESTING** |
| Open Council Network — Ealing | Borough-wide | Independent civic data / analysis | Conservative public-page bridge; richer API/partnership remains desirable | **INGESTING** |
| The View from W5 | Ealing | Independent newsletter | Substack RSS | **INGESTING** |
| MySouthall | Southall | Newsletter / campaigning | Substack RSS | **INGESTING** |
| Southall Speaks | Southall | Independent local publication / community voice | Substack RSS via additional-source module | **INGESTING** |
| Vicious Ealing Council | Borough-wide | Independent civic commentary / campaign | WordPress RSS with public-page fallback; publisher claims remain attributable to the publisher | **INGESTING** |
| Visit Southall — News | Southall | Local news / information publication | Source-specific adapter over dated first-party news pages | **INGESTING** |
| Positive Greenford | Greenford | Hyperlocal publishing | Native RSS | **INGESTING** |
| Ealing Wildlife Group | Borough-wide | Environment / community | RSS with dated-blog fallback | **INGESTING** |
| Around Ealing | Borough-wide | Official council publication | RSS; publisher town categories retained as place metadata | **INGESTING** |
| Visions for Northolt | Northolt | Official regeneration/project publishing | Source-specific dated-page adapter | **INGESTING** |
| Stop The Towers — Campaign News | Ealing | Planning / development campaign | Source-specific adapter; older material retained for civic memory | **INGESTING** |
| Friends of the Victoria Hall — Chronology | Ealing | Civic / heritage campaign | Source-specific chronology adapter | **INGESTING** |
| Metropolitan Police — Ealing | Borough-wide | Official public-safety publishing | Official newsroom / neighbourhood material filtered for Ealing relevance | **INGESTING** |
| Ealing Citizens / Citizens UK | Borough-wide | Community organising | West London archive filtered for explicit Ealing relevance | **INGESTING** |

The combined feed also invokes dedicated adapters for selected rich civic-source sites, community pages, living publications, filtered civic video and faith/community publishing. Those modules deliberately return no item rather than inventing dates or relevance when a source cannot be parsed safely.

---

# 2. Sources that were previously easy to misread

This is the part of the register most affected by the v0.3 status ambiguity.

| Source | v0.3 wording | Audited v0.4 status | Note |
|---|---|---|---|
| **EALING.NEWS — Southall** | `LIKELY` with candidate tag feed | **CANDIDATE** | `https://www.ealing.news/tag/southall/feed/` is not in the current live source configuration. Do not describe EALING.NEWS as ingested unless it is actually added. |
| **Ealing Council — News** | Not clearly distinguished from EALING.NEWS in the census narrative | **INGESTING** | This is the source we have definitely implemented: `https://www.ealing.gov.uk/rss/news`, plus council category RSS enrichment. |
| **Ealing Civic Society** | `LIKELY` | **INGESTING** | Current code uses `https://ealingcivicsociety.org/feed/`. |
| **The Neighbours’ Paper** | `CHECK` | **INGESTING** | Current code uses `https://neighbourspaper.org/feed/`. |
| **Open Council Network — Ealing** | `PARTNER` | **INGESTING** | Public-page bridge is live now; an API/public-interest partnership would be an enhancement rather than the first integration. |
| **Southall Speaks** | `READY` | **INGESTING** | Live through the additional Southall-source module. |
| **Visit Southall — News** | `READY` | **INGESTING** | Live through its source-specific adapter. |
| **Vicious Ealing Council** | `READY` | **INGESTING** | Live through RSS/fallback handling. |
| **Stop The Towers** | `READY` | **INGESTING** | Live through a dedicated campaign-news adapter. |
| **Friends of the Victoria Hall** | `READY` | **INGESTING** | Live through a dedicated chronology adapter. |

The key rule from now on is simple: **READY/VERIFIED must never be used as a synonym for INGESTING.**

---

# 3. Verified or candidate publishing sources not currently in the audited live set

| Source | Geography | Type | Status | Integration / notes |
|---|---|---|---|---|
| EALING.NEWS — Southall | Southall / borough | Local journalism | **CANDIDATE** | Candidate WordPress tag feed: `https://www.ealing.news/tag/southall/feed/`; needs fresh verification and an explicit ingestion decision. |
| Asian Standard — Southall | Southall | Regional/local journalism | **VERIFIED** | Category RSS was previously verified, but it is not present in the current audited live source configuration. Re-test before enabling. |
| Bedford Park Society | Acton | Conservation / residents | **VERIFIED** | RSS previously verified; not present in the current audited live source configuration. |
| Southall Community Alliance | Southall | Community alliance / charity | **PARTNER** | Current live site with fresh 2026 material; direct publishing bridge/partnership remains preferable. |
| Central Acton Neighbourhood Forum | Acton | Neighbourhood planning | **PARTNER** | Active news pages; feed/integration still needs a deliberate choice. |
| Churchfield Community Association | Acton | Community / planning | **PARTNER** | Active source; feed requires technical/manual check. |
| Church Avenue Residents’ Association | Ealing | Residents | **CANDIDATE** | Blogger site; Atom/RSS likely, endpoint still to verify. |
| Hanger Hill (East) Residents’ Association | Ealing | Residents / planning | **PARTNER** | Active site; native feed unclear. |
| Hanger Hill Garden Estate Residents’ Association | Ealing | Residents / conservation | **PARTNER** | Site/news present; RSS not yet verified. |
| Norwood Green Residents’ Association | Southall / Norwood Green | Residents / community | **PARTNER** | Site has downloadable newsletters; feed not yet verified. |
| Hanwell Community Forum | Hanwell | Broad community forum | **PARTNER** | High-priority Hanwell source/partner candidate. |
| Grand Union Alliance | Multi-area canal corridor | Environment / planning / community | **PARTNER** | Potentially relevant across Greenford, Southall and Old Oak. |

This table is intentionally conservative. A source is not promoted to `INGESTING` merely because a feed exists.

---

# 4. Wider civic-organisations census

The detailed borough census assembled in v0.3 remains useful for discovery and coverage analysis. It includes residents' associations, neighbourhood forums, conservation panels, tenant/resident bodies, environmental and allotment groups, arts/cultural campaigns, development campaigns, accessibility groups and community alliances.

See the historical census in [Source Register v0.3](./source-register-v0.3.md). Its organisation list remains useful; **its old READY/LIKELY/PARTNER status column should no longer be read as operational ingestion state**.

Future additions from that census should pass through four separate decisions:

1. **Discovery** — is the organisation/source current and relevant?
2. **Verification** — is there a dependable first-party feed/page/API/bridge?
3. **Editorial fit** — should this material enter the main timeline, Document Watch, civic memory, or remain reference-only?
4. **Integration** — has it actually been added to the production aggregation path and source-health output?

Only step 4 earns `INGESTING`.

---

# 5. Geographic coverage

Coverage remains uneven. Acton and Ealing have dense civic-source networks. Southall now has a much healthier mixed source set spanning independent reporting, community publishing, residents/campaign groups and official records. Greenford has improved with Positive Greenford; Northolt has an implemented project source through Visions for Northolt.

**Perivale remains the clearest geographic publishing gap**, and Hanwell still needs stronger routine first-party publishing coverage despite useful civic organisations being known there.

A thin register must not be interpreted as thin civic life. Gaps should trigger deliberate discovery and partnership work.

---

# 6. Source-governance rules

- The Commons must preserve publisher identity and canonical links.
- Publisher allegations or claims remain attributable to the publisher; ingestion does not turn them into Civic Commons assertions.
- Native RSS/Atom is preferred where available, but safe source-specific adapters are legitimate when they preserve first-party provenance and stable identities.
- Closed social networks should not become foundational dependencies.
- High-volume official feeds must not crowd quieter civic publishers out of the live view.
- Routine document publishing belongs in Document Watch/civic memory rather than automatically dominating the attention timeline.
- Source failures should be visible through health diagnostics rather than silently disappearing.
- The register should be updated in the same PR whenever a source is added, removed, materially reworked or reclassified.

---

# 7. Keeping this register honest

The long-term fix is to reduce manual drift. The production source definitions already contain stable IDs, publisher names, homepages and integration methods. A future maintenance improvement should generate the `INGESTING` portion of this register from those definitions (or validate the Markdown against them) during CI.

Until then, code + public source health are authoritative for live state, and this document must be reconciled against them whenever source work lands.
