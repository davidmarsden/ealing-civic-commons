# Ealing planning-source probe

This is a deliberately small diagnostic for testing whether planning applications can become a first-class Civic Commons source.

It does **not** ingest applications into the Commons, expose a public feed, copy planning documents, or create civic entities. Its job is to compare source freshness and technical accessibility before we choose an ingestion architecture.

## Sources tested

### 1. Ealing PAM / Civica Public Access

Authoritative council source:

- https://pam.ealing.gov.uk/online-applications/
- Weekly list: https://pam.ealing.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application

The probe first loads the weekly-list form, discovers its current field names/options, chooses the latest available week and validated applications, submits the form, and counts application-detail links in the result. This is intentionally form-driven rather than hard-coding Civica parameter names.

PAM should be treated as the authoritative reference. Any future Commons record should link back to PAM rather than mirror application documents.

### 2. Planning Data (MHCLG)

- https://www.planning.data.gov.uk/dataset/planning-application
- API documentation: https://www.planning.data.gov.uk/docs

The national API has an excellent open, structured model and supports geographic queries, but the planning-application dataset is currently experimental and may lag local-authority systems. It is useful as a coverage comparator and may become the preferred ingestion source once authoritative Ealing data is supplied regularly.

### 3. PlanWire

- https://planwire.io/uk-planning-data/ealing

PlanWire is optional and only queried when `PLANWIRE_API_KEY` is present. It is useful as a freshness/coverage comparator, but the spike deliberately avoids making Civic Commons depend on it.

## Run locally

```bash
npm run inspect:planning
```

The command writes `planning-probe.json` in the repository root. To choose another path:

```bash
node scripts/planning-probe.mjs --verbose --output=/tmp/ealing-planning.json
```

Set `PLANWIRE_API_KEY` to include PlanWire in the comparison.

## What success looks like

The next implementation phase should only begin if the probe establishes that we can reliably obtain a recent Ealing application list with stable identifiers and authoritative links.

A future normalized Civic Commons planning object would likely include:

- application reference
- address / site name
- proposal description
- validation date
- decision/status and decision date
- ward and town
- coordinates or site geometry where lawfully/reliably available
- authoritative PAM URL
- source provenance and retrieval timestamp

The first public version should focus on discovery and following, not document mirroring: planning application → place/site → ward/town → related council meetings/decisions → relevant reporting and community context.

## Guardrails

- Prefer open/public factual data over copying expressive documents or drawings.
- Do not republish PAM mapping tiles or Ordnance Survey material.
- Keep a prominent authoritative source link on every derived record.
- Record retrieval/provenance dates and expose uncertainty where coverage is incomplete.
- Rate-limit polling and avoid unnecessary requests.
- Do not treat absence from an experimental/open dataset as proof that no application exists.
