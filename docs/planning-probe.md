# Ealing planning integration

**Updated:** 8 September 2026  
**Status:** Live v1 — latest-week discovery/context

Planning applications from the latest completed Ealing Council PAM week are now exposed as first-class current Civic Commons records.

The work began as a diagnostic spike against Ealing Council's Civica Public Access (PAM) system. That probe established a reliable, low-rate ingestion path using the live weekly-list form, its current CSRF/session state and the latest completed Ealing week. The integration has now moved beyond probing into a public, reviewable planning layer.

## Authoritative source

Ealing Council PAM remains canonical:

- https://pam.ealing.gov.uk/online-applications/
- Weekly list: https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application

Civic Commons does not mirror planning documents, drawings, mapping tiles or the council's full application pages. It publishes factual discovery metadata and deep-links back to the authoritative council record.

## Current ingestion model

The ingestion flow is deliberately separated from the public site build:

1. load the live PAM weekly-list form;
2. preserve its current hidden/default fields, CSRF value and session state;
3. choose the latest completed week in `Europe/London` time;
4. walk all weekly result pages and deduplicate application links;
5. fetch application summary pages at low rate;
6. normalize the public factual fields;
7. validate completeness before publication;
8. generate a committed static **latest-week** planning snapshot;
9. open/update through the normal reviewed repository workflow rather than scraping PAM during page requests.

A partial ingest is not allowed to replace the last complete public snapshot.

The public site therefore remains available if PAM or another upstream service is temporarily unavailable.

## Current retention boundary

The live planning layer is **not yet a historical planning archive**.

`planning-latest.json` is reconstructed from the latest completed week and replaced on the next successful refresh. The planning list, planning record route, place dossier and issue dossier all read that current snapshot. An application that is absent from the next snapshot therefore stops appearing in those planning views.

This distinction matters:

- the **place/issue identity is durable**;
- the **current planning card is not yet durable planning history**;
- `/planning/{reference}` is currently available only while that record is present in the published snapshot;
- retaining prior applications, status changes and decisions across refreshes is the next architectural step.

## Current public planning object

The public object is intentionally conservative. It includes:

- application reference;
- address / site name;
- proposal description;
- current status;
- validated date;
- coarse Civic Commons category where deterministically derivable;
- town where conservatively classifiable;
- out-of-borough flag;
- authoritative PAM URL;
- Commons route while the application remains in the current snapshot;
- explicit place links and their provenance.

Applicant/agent contact details, planning documents and other unnecessary personal or expressive material are not copied into the Commons.

## Planning → place context

The important civic relationship is not merely "application in a weekly list". Civic Commons treats the **place** as the durable civic object.

Current planning records can carry explicit `place_links`:

- **town-classification** — generated only from conservative place/address classification;
- **reviewed-rule** — a deliberately reviewed relationship to a specific site/place.

For example, application `263308CND` at **2 The Straight, Southall** is linked in the current snapshot both to the Southall town place and, through an explicit reviewed rule, to the **Southall Gasworks** place identity.

While the record remains in the published snapshot, the same application can appear on:

- the public Planning view;
- its `/planning/...` route;
- the Southall place page;
- the Southall Gasworks place dossier;
- the Southall Gasworks redevelopment issue through that issue's primary place.

The place/issue graph is durable civic memory. The weekly planning snapshot is currently transient input layered onto it.

## Issue context

Issue pages can inherit current planning records through their reviewed primary place relationship. This is intentionally explicit rather than based on fuzzy name matching.

The first live example is **Southall Gasworks redevelopment → Southall Gasworks → planning application 263308CND** while that application is present in the current snapshot.

## Public presentation

Civic entity and issue pages use the same dossier-card model. Major sections are clickable cards and section navigation is generated in the same order as the visible cards.

The current layer is presented before the deeper research dossier:

1. current civic facts / local evidence where available;
2. Current Commons material;
3. Planning register where current records exist;
4. primary evidence;
5. historical reporting;
6. reviewed connections / issue participants where applicable.

Primary evidence, historical reporting and reviewed connections can stay compact until a reader chooses to expand them. Deep links open the relevant card.

All people, organisation and place routes use the same canonical civic-entity template so one place cannot silently drift onto an older presentation path.

## Secondary/comparator sources

### Planning Data (MHCLG)

- https://www.planning.data.gov.uk/dataset/planning-application
- https://www.planning.data.gov.uk/docs

The national API remains useful as an open structured comparator and possible future enrichment source, but Ealing application freshness has lagged the council's own PAM register. Absence there must never be treated as evidence that an application does not exist.

### PlanWire

- https://planwire.io/uk-planning-data/ealing

PlanWire remains an optional comparator only. Civic Commons does not depend on it.

## Commands

Probe source accessibility/freshness:

```bash
npm run inspect:planning
```

Create an inspection-only normalized ingest:

```bash
npm run inspect:planning-ingest
```

Publish a validated snapshot from an inspection artifact:

```bash
npm run publish:planning-snapshot
```

The scheduled/manual refresh workflow performs these steps separately from Netlify deployment and only proposes a repository change when the public snapshot changes.

## Guardrails

- Ealing Council's planning register remains canonical.
- Prefer factual public-register metadata over copying expressive documents or drawings.
- Do not republish PAM mapping tiles or Ordnance Survey material.
- Preserve application references and authoritative deep links.
- Keep place relationships explicit and provenance-bearing.
- Do not infer specific site relationships fuzzily when a reviewed rule is more appropriate.
- Minimise personal data; do not turn private applicants into civic profiles merely because their names appear on a public register.
- Rate-limit requests and cache results rather than scraping PAM during public page loads.
- Never replace a complete public snapshot with an incomplete ingest.
- Do not describe the current latest-week layer as persistent planning history until records survive refreshes.
- The Commons must remain useful when PAM is temporarily unavailable.

## Next planning work

The first priority is persistence, then enrichment:

- retain applications across weekly refreshes with explicit update/version semantics;
- capture lifecycle updates from validated to decided applications;
- add ward/site geography where reliably available;
- connect related applications and site history;
- link retained planning to committees, decisions, documents and reporting where reviewed/deterministic;
- consider follows/alerts for places and planning records where this adds real reader value;
- broader historical backfill only once retention/update semantics and rate/copyright/licensing boundaries are clear.
