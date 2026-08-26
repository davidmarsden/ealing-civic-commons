# Southall & Ealing Civic Commons
## Source Register — v0.3

**Date:** 26 August 2026  
**Status:** Expanded borough civic-organisations census  
**Coverage:** Ealing's seven distinct towns/areas — **Acton, Ealing, Greenford, Hanwell, Northolt, Perivale and Southall**.

This version merges the initial source census with the full Ealing Civic Society residents' organisations list and the wider Ealing Matters member-groups list.

It distinguishes between:
- native machine-readable feeds;
- active organisations that may need a partner bridge;
- reference-only civic organisations;
- social-only groups;
- stale/historic sources.

### Status key

- **READY** — open feed verified or strongly established.
- **LIKELY** — modern publishing site where a feed is likely; verify before ingestion.
- **PARTNER** — valuable live source where direct partnership/bridge may be better than scraping.
- **REFERENCE** — useful organisation/directory/context source, but not a routine timeline publisher.
- **SOCIAL-ONLY** — Facebook/X/Ning etc.; do not depend on as core infrastructure.
- **STALE/HISTORIC** — useful for civic memory but not dependable as a current feed.
- **CHECK** — current status/feed still needs investigation.

---

# 1. Core Southall and borough-wide publishing sources

| Source | Geography | Type | Status | Integration / notes |
|---|---|---|---|---|
| Southall Stories | Southall | Independent journalism | READY | RSS / Micro.blog. Founding participant, not owner. |
| Southall Residents Alliance | Southall | Residents / campaign | READY | Verified RSS: `https://southallresidentsalliance.co.uk/feed/` |
| MySouthall | Southall | Newsletter / campaigning | READY | Substack RSS: `https://southall.substack.com/feed` |
| Southall Transition | Southall | Community / sustainability | READY | Verified RSS: `https://southalltransition.org/feed/` |
| Southall Community Alliance | Southall | Community alliance / charity | PARTNER | Current live site: `https://southallcommunityalliance.com/`; fresh 2026 news. |
| EALING.NEWS — Southall | Southall / borough | Local journalism | LIKELY | Candidate WordPress tag feed: `https://www.ealing.news/tag/southall/feed/` |
| Asian Standard — Southall | Southall | Regional/local journalism | READY | Verified category RSS. |
| Ealing Matters | Borough-wide | Civic alliance | READY | Verified RSS; important source-discovery network. |
| The View from W5 | Ealing / borough | Independent newsletter | READY | Verified Substack/XML feed. |
| West Ealing Neighbours | West Ealing | Community publisher | READY | Verified RSS. |
| Ealing Civic Society | Borough-wide | Civic / conservation / planning | LIKELY | Active WordPress site; verify main/category feeds. |
| Ealing Council ModernGov | Borough-wide | Official democratic record | READY | Official "What's new" RSS: `https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0` |
| Open Council Network — Ealing | Borough-wide | Structured civic data | PARTNER | API/public-interest pilot preferred. |
| Nomis | Borough / wards | Official statistics | REFERENCE | Contextual API/datasets, not normal timeline feed. |

---

# 2. Acton and Old Oak / Park Royal civic sources

| Organisation | Type / focus | Status | Website / integration note |
|---|---|---|---|
| Acton Green Residents' Association (AGRA) | Residents / planning | CHECK | `https://actongreen.org.uk/` |
| Acton Hill Neighbourhood Forum | Neighbourhood forum | REFERENCE / SOCIAL-ONLY | No website supplied; contact/Facebook route. |
| Bedford Park Society | Conservation / residents | READY | Active site; RSS previously verified. |
| Central Acton Neighbourhood Forum (CANForum) | Neighbourhood planning | PARTNER | `https://canforum.org.uk/`; active news pages; feed not yet verified. |
| Churchfield Community Association | Community / planning | PARTNER | `http://churchfield.org/`; active source, feed requires manual/technical check. |
| Creffield Area Residents' Association | Residents / planning | CHECK | `http://caraealing.org/` |
| East Acton Golf Links Residents' Association | Residents / planning | READY | Verified WordPress RSS: `https://eaglra.wordpress.com/feed/` |
| Friary Green Residents' Association | Residents / planning | CHECK | `http://friarygreenresidents.org.uk/` |
| Goldsmiths Residents Association | Residents | PARTNER | Google Sites; likely bridge/reference rather than native feed. |
| Gunnersbury Park Neighbours | Community | REFERENCE / SOCIAL-ONLY | No independent website supplied. |
| Island Triangle Residents' Association | Residents / Old Oak | PARTNER | Connected to Old Oak Neighbourhood Forum. |
| Mill Hill Park Residents' Association | Residents / conservation | CHECK | `http://millhillparkacton.org/` |
| Old Oak Neighbourhood Forum | Neighbourhood planning | PARTNER | `http://oldoakneighbourhoodforum.org/`; potentially high-value structured local planning source. |
| South Acton Residents' Action Group (SARAG) | Tenant/resident management | PARTNER | `http://sarag.org/` |
| Wells House Road Residents' Association | Residents / Old Oak | PARTNER | Via Old Oak Neighbourhood Forum. |
| Wesley Estate Residents' Association | Residents / Old Oak | PARTNER | Via Old Oak Neighbourhood Forum. |
| West Acton Residents' Association | Residents / planning | CHECK | `http://westactonresidents.org.uk/` |
| Cap the Towers | Development campaign | SOCIAL-ONLY | X/Twitter listed; no open publishing site found in source lists. |

---

# 3. Ealing / West Ealing civic sources

| Organisation | Type / focus | Status | Website / integration note |
|---|---|---|---|
| Central Ealing Neighbourhood Forum (CENF) | Neighbourhood planning | PARTNER | `http://centralealingforum.com/`; valuable planning archive/current reference. |
| Central Ealing Residents' Association (CERA) | Residents / planning / licensing | PARTNER | `http://cera.org.uk/` |
| Friends of Haven Green | Parks / conservation | REFERENCE | Merged into CERA at CERA's October 2024 AGM; retain as historic identity/source. |
| Campaign for an Ealing Performance and Arts Centre (CEPAC) | Arts / civic campaign | CHECK | `http://cepac.org.uk/` |
| Church Avenue Residents' Association | Residents | LIKELY | Blogger: `http://churchave.blogspot.com/`; likely Atom/RSS, verify endpoint. |
| Draytons Community Association | Community | SOCIAL-ONLY / PARTNER | Ning network; avoid foundational dependency. |
| Ealing Allotments Partnership | Allotments / environment | PARTNER | `https://www.ealingallotmentspartnership.co.uk/` |
| Ealing Arts and Leisure | Arts / culture | PARTNER | `https://www.ealingarts.org.uk/` |
| Ealing Civic Society | Civic / planning / conservation | LIKELY | Active WordPress site. |
| Ealing Dean Allotments Society | Allotments | CHECK | `http://ealingdean.co.uk/` |
| Ealing Dean Residents' Association | Residents | REFERENCE / SOCIAL-ONLY | No website supplied. |
| Ealing Fields Residents' Association | Residents | CHECK | `http://efra.org.uk/` |
| Ealing's Forgotten Spaces | Place / planning campaign | REFERENCE / SOCIAL-ONLY | No website supplied. |
| Ealing Town Centre Conservation Area Panel | Conservation | REFERENCE | No website supplied. |
| Ealing Transition | Sustainability / community | READY | Verified RSS: `https://ealingtransition.org.uk/feed/` |
| Ealing Transport for All | Transport / accessibility | REFERENCE / SOCIAL-ONLY | No website supplied. |
| Five Roads Forum | Residents | SOCIAL-ONLY | Facebook highlighted by Ealing Matters. |
| Friends of the Victoria Hall | Civic / heritage campaign | PARTNER | Weebly: `https://savethevictoriahall.weebly.com/` |
| Gordon Road and Surrounding Streets Residents' Association (GRASS) | Residents | REFERENCE | No website supplied. |
| Hanger Hill (East) Residents' Association (HHERA) | Residents / planning | PARTNER | `http://hhera.com/`; active site, native feed unclear. |
| Hanger Hill Garden Estate Residents' Association | Residents / conservation | PARTNER | `http://hhgera.com/`; site/news present, RSS not yet verified. |
| Hanger Hill Ward Panel | Ward / policing/community | REFERENCE | No website supplied. |
| Kingsdown Residents' Association | Residents | REFERENCE | No website supplied. |
| Park Community Group | Residents / planning / UWL | PARTNER | Current site previously found at `thepcg.org.uk`; old listing omitted URL. |
| Pioneer Court Residents' Association | Residents | REFERENCE / SOCIAL-ONLY | No website supplied. |
| Pitshanger Community Association | Community / parks / shops | PARTNER | Contact supplied; website absent in Ealing Matters list, older Civic Society listing used `pitshanger.org.uk`. |
| Redbrick Residents' Association | Residents | REFERENCE / SOCIAL-ONLY | No website supplied. |
| Saint Stephen's Conservation Area Advisory Panel | Conservation | REFERENCE | No website supplied. |
| Save Ealing's Centre | Planning / town centre | PARTNER | `http://saveealingscentre.com/` |
| Save Gurnell | Planning / leisure / development | PARTNER | `http://savegurnell.org.uk/index.html` |
| Shaa Road Residents' Association | Residents | REFERENCE | No website supplied. |
| Sherwood Close Residents' Association | Residents | REFERENCE | No website supplied. |
| Stop the Towers | Planning / high-rise development | PARTNER | Current Ealing Matters URL: `https://stopthetowers.info/` |
| Walpole Residents' Association | Residents / planning / transport | CHECK | `http://walpoleresidents.org/` |
| West Ealing Neighbours | Community / business / residents | READY | Verified RSS. |
| The Neighbours' Paper | Local publication | CHECK | `http://www.neighbourspaper.com/`; investigate current status/feed. |
| Friends of Haven Green | Historic/current conservation identity | REFERENCE | Do not double-count separately from CERA after merger. |

---

# 4. Hanwell civic sources

| Organisation | Type / focus | Status | Website / integration note |
|---|---|---|---|
| Boston Manor Residents' Association | Residents / planning / traffic / policing | CHECK | `http://bostonmanorresidentsassociation.org/` |
| Hanwell Community Forum | Broad community forum | PARTNER | `http://hanwellcommunityforum.org.uk/`; high-priority Hanwell partner candidate. |
| Hanwell Conservation Area Panel | Conservation | REFERENCE | No website supplied. |
| Hanwell Village Green Residents' Association | Residents | PARTNER | Google Sites: `https://sites.google.com/view/hanwellvillagegreenw7/`; bridge/reference likely. |
| Olde Hanwell Residents' Association | Residents | STALE/HISTORIC / CHECK | Ealing Matters points to old Google Group; previous website link obsolete. Investigate current organisation. |

---

# 5. Greenford / Perivale / Northolt civic sources

| Organisation | Town / area | Type / focus | Status | Website / integration note |
|---|---|---|---|---|
| Brentham Society | Ealing / Greenford edge | Heritage / residents | PARTNER | `https://brentham.com/brentham/brentham-society/` |
| Greenshoots Racecourse Community Group | Northolt | Community | REFERENCE / SOCIAL-ONLY | No website supplied; contact available. |
| North Greenford Residents' Association | Greenford | Residents | REFERENCE | No website supplied; email contact only. |
| Northolt Residents' Association | Northolt | Residents | STALE/HISTORIC / CHECK | Earlier Tripod site appears obsolete; Ealing Matters supplies contact email. |
| Norwood Green Residents' Association | Southall / Norwood Green | Residents / community | PARTNER | `http://norwoodgreen.org/`; site has downloadable newsletters; feed not yet verified. |
| Save Gurnell | Greenford / Ealing | Development / leisure | PARTNER | `http://savegurnell.org.uk/index.html` |
| Grand Union Alliance | Canal corridor / multi-area | Environment / planning / community | PARTNER | Wix site; potentially relevant to Greenford/Southall/Old Oak corridor. |

**Important gap:** neither the Ealing Civic Society list nor the Ealing Matters list provides a convincing **Perivale-specific residents' organisation**. Greenford and Northolt remain thin as well.

That gap should trigger deliberate discovery rather than being interpreted as lack of civic activity.

---

# 6. Borough-wide and thematic civic organisations

| Organisation | Theme | Status | Integration note |
|---|---|---|---|
| Ealing Matters | Civic alliance | READY | Main feed plus useful member-network metadata. |
| Ealing Civic Society | Conservation / planning / heritage | LIKELY | Active WordPress publication. |
| Ealing Allotments Partnership | Environment / allotments | PARTNER | Possible thematic feed/bridge. |
| Ealing Arts and Leisure | Culture | PARTNER | Useful cultural civic layer. |
| Ealing Transition | Sustainability | READY | Verified RSS. |
| Ealing Transport for All | Accessible transport | REFERENCE / SOCIAL-ONLY | Important inclusion voice even without open feed. |
| Grand Union Alliance | Canal/environment/development | PARTNER | Cross-town thematic source. |
| The Covenant Movement | Civic/community | REFERENCE | No website supplied; identify current role before inclusion. |

---

# 7. What this merged census tells us

## A. The borough's civic web is much larger than the first list suggested

The combined Civic Society + Ealing Matters network includes:
- traditional residents' associations;
- neighbourhood planning forums;
- conservation panels;
- tenant/resident bodies;
- environmental and allotment groups;
- arts/cultural campaigns;
- development campaigns;
- accessibility/transport groups;
- community alliances.

The Commons source model therefore needs `organisation_type` as well as `source_type`.

## B. Southall improves materially in this pass

Southall now has at least these potentially ingestible/partner sources:
- Southall Stories
- Southall Residents Alliance
- MySouthall
- Southall Transition
- Southall Community Alliance
- EALING.NEWS — Southall
- Asian Standard — Southall
- Norwood Green Residents' Association
- plus borough-wide sources relevant to Southall

Southall Transition is especially useful because its RSS endpoint is verified.

## C. Open publishing is common, but not universal

Confirmed new RSS feeds from this pass include:
- Southall Transition
- Ealing Transition
- East Acton Golf Links Residents' Association

Other groups use Blogger, WordPress, Wix, Google Sites, Ning, PDFs or no website at all.

The Commons should therefore offer an **onboarding bridge service** rather than demanding RSS literacy from partners.

## D. Coverage bias remains a governance issue

Acton and Ealing are densely represented in both source lists.

Greenford, Northolt, Perivale and parts of Southall are substantially less represented.

This supports the Charter's explicit warning that a borough-wide service must not assume the priorities of **Ealing, Southall, Greenford, Acton, Northolt, Perivale or Hanwell are interchangeable**.

The registry should record not only what it contains, but where coverage is weak.

---

# 8. Revised prototype source set

## Native-feed / near-native Phase 1

1. Southall Stories
2. Southall Residents Alliance
3. MySouthall
4. Southall Transition
5. EALING.NEWS — Southall
6. Asian Standard — Southall
7. Ealing Matters
8. The View from W5
9. West Ealing Neighbours
10. Bedford Park Society
11. Ealing Transition
12. East Acton Golf Links Residents' Association
13. Ealing Council ModernGov

## Partner/bridge shortlist

1. Southall Community Alliance
2. Ealing Civic Society
3. CERA
4. CANForum
5. Hanwell Community Forum
6. Old Oak Neighbourhood Forum
7. Park Community Group
8. Save Ealing's Centre
9. Save Gurnell
10. Norwood Green Residents' Association

## Structured democracy

- Open Council Network API / pilot partnership

---

# 9. Proposed machine-readable registry schema

```yaml
id:
name:
aliases: []
organisation_type:
organisation_status: active | merged | dormant | historic | unknown
successor_source_id:
towns: []
wards: []
neighbourhoods: []
topics: []
homepage_url:
feed_urls: []
feed_type:
integration_mode: native_feed | partner_bridge | reference_only | social_only
source_class:
is_official:
is_partisan:
canonical_source:
last_verified_at:
last_content_at:
contact_status:
coverage_confidence:
notes:
```

The registry should also produce a **coverage report by town and source class**, so the Commons can see where its information ecosystem is structurally weak rather than merely where it has fewer URLs.
