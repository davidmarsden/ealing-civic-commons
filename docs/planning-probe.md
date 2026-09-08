# Ealing planning integration

**Updated:** 8 September 2026  
**Status:** Live v1

Planning applications are now a first-class Civic Commons civic record type.

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
8. generate a committed static planning snapshot;
9. open/update through the normal reviewed repository workflow rather than scraping PAM during page requests.

A partial ingest is not allowed to replace the last complete public snapshot.

The public site therefore remains available if PAM or another upstream service is temporarily unavailable.

## Canonical public planning object

The first public object is intentionally conservative. It includes:

- stable Commons planning ID;
- application reference;
- address / site name;
- proposal description;
- current status;
- validated date;
- coarse Civic Commons category where deterministically derivable;
- town where conservatively classifiable;
- out-of-borough flag;
- authoritative PAM URL;
- stable Commons route such as `/planning/{reference}`;
- explicit place links and their provenance.

Applicant/agent contact details, planning documents and other unnecessary personal or expressive material are not copied into the Commons.

## Planning → place memory

The important civic relationship is not merely "application in a weekly list". Civic Commons treats the **place** as the durable civic object.

Planning records can therefore carry explicit `place_links`:

- **town-classification** — generated only from conservative place/address classification;
- **reviewed-rule** — a deliberately reviewed relationship to a specific site/place.

For example, application `263308CND` at **2 The Straight, Southall** is linked both to the Southall town place and, through an explicit reviewed rule, to the **Southall Gasworks** place identity.

This means the same application can appear on:

- the public Planning view;
- its stable `/planning/...` civic object;
- the Southall place page;
- the Southall Gasworks place history;
- the Southall Gasworks redevelopment issue through that issue's primary place.

The weekly list is temporary input; the place/issue graph is the durable civic memory.

## Issue context

Issue pages can inherit planning records through their reviewed primary place relationship. This is intentionally explicit rather than based on fuzzy name matching.

The first live example is **Southall Gasworks redevelopment → Southall Gasworks → planning application 263308CND**.

## Public presentation

Civic entity and issue pages now use the same dossier-card model. Major sections are clickable cards and section navigation is generated in the same order as the visible cards.

The current layer is presented before the deeper research dossier:

1. current civic facts / local evidence where available;
2. Current Commons material;
3. Planning register;
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
- Preserve stable references and authoritative deep links.
- Keep place relationships explicit and provenance-bearing.
- Do not infer specific site relationships fuzzily when a reviewed rule is more appropriate.
- Minimise personal data; do not turn private applicants into civic profiles merely because their names appear on a public register.
- Rate-limit requests and cache results rather than scraping PAM during public page loads.
- Never replace a complete public snapshot with an incomplete ingest.
- The Commons must remain useful when PAM is temporarily unavailable.

## Next planning work

The next useful work is enrichment, not broader scraping:

- ward/site geography where reliably available;
- lifecycle updates from validated to decided applications;
- stronger place/site history and related-application relationships;
- links to committees, decisions, documents and reporting where reviewed/deterministic;
- follows/alerts for places and planning records where this adds real reader value;
- historical backfill only once the live model is stable and rate/copyright/licensing boundaries are clear.
