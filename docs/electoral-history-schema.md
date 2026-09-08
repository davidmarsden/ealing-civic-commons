# Structured electoral history

**Status:** implementation schema for Ealing Civic Commons  
**Scope:** local-election candidacies, profile linkage, boundary eras and provenance

Candidacy is modelled as a **dated public civic event**, not as an undated personal attribute. The canonical event record remains valid even when person-identity matching is unresolved or ambiguous.

## Record shape

Each candidacy record contains:

- `id` — stable event identifier derived from election date, ward and source candidate name;
- `council` — Ealing authority identity;
- `electionYear`, `electionDate`, `electionType`, `electionLabel`;
- `candidateNameSource` — candidate name exactly as supplied by the immediate data source;
- `ward.name`, `ward.slug`, optional Electoral Commission `ward.ecCode`;
- `ward.boundaryEra` — explicit boundary-era identifier, label and caution note;
- `ballot.description` — party/ballot label supplied by the source;
- `ballot.canonicalParty` — canonical party label where available;
- `ballot.fidelity` — whether the description is source-page text or a source-normalised label;
- `votes`;
- `result.elected`, optional rank and source elected flag;
- `provenance` — immediate provider, source/data URL, upstream source relationship and licence;
- `identity` — separate Civic Commons person-match assertion with status, route, method, confidence and review state.

## Boundary eras

The first implementation deliberately distinguishes:

- `ealing-pre-2022` — wards in the pre-2022 boundary scheme;
- `ealing-2022-current` — wards used from the May 2022 all-out election onward.

A ward name is never sufficient by itself to assert geographic continuity across boundary eras. Electoral Commission ward codes are retained where the source provides them.

## Party and ballot descriptions

Direct 2026 Ealing Council result pages are marked `source-page-text`.

The electionresults.uk historical dataset normalises party names. Those labels are therefore marked `normalized-by-source` and must not be presented as verbatim nomination-paper wording. This distinction is part of the record rather than hidden in documentation.

## Provenance chain

The initial structured history combines:

- **2026** — direct Ealing Council published result pages;
- **2022** — electionresults.uk structured candidate/race data, whose documented upstream source is the House of Commons Library Local Election Handbook;
- **2018** — electionresults.uk structured candidate/race data, whose documented upstream source is Andrew Teale's Local Elections Archive Project (LEAP).

The immediate provider and upstream source are both retained. A derived source never silently replaces the source from which it obtained the electoral record.

## Person identity matching

Identity linkage is intentionally separate from the event.

The first resolver may attach a candidacy to a current councillor only where surname + first initial resolves uniquely among current Ealing councillors. For 2026, current ward is also used when available. The assertion records its method and confidence and is marked `algorithmic` rather than `reviewed`.

Ambiguous names are left unattached. A valid candidacy event does not become invalid merely because Civic Commons cannot yet say with sufficient confidence which person profile it belongs to.

This is particularly important for:

- abbreviated historical candidate names;
- people with the same surname and initial;
- name changes or alternative public names;
- ward boundary changes;
- candidates who changed party or ward between elections.

## Presentation rule

A current councillor profile may display linked candidacies chronologically, but each row must retain its own election date, ward/boundary era, ballot description, votes/result and source.

Historical party or ward must not be rewritten into the person's current profile attributes. The profile is the identity; the candidacies are dated assertions around it.
