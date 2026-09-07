# Source Register additions — 7 September 2026

**Status:** operational addendum to Source Register v0.4  
**Scope:** electoral history, councillor/candidate provenance and public-person discovery

This addendum records two electoral-history sources added after the 6 September 2026 v0.4 audit. They are **reference layers**, not routine timeline publishers, so neither should be described as `INGESTING` into the main Commons feed.

| Source | Geography | Type | Status | Integration / notes |
|---|---|---|---|---|
| Andrew Teale’s Local Elections Archive Project (LEAP) | Borough-wide / historical | Historical local-election archive | **REFERENCE** | Ealing is listed under **E** in the LEAP elections index: `https://www.andrewteale.me.uk/leap/elections-index/#E`. Use for long-run ward, candidate and result history. Historical records should retain election date, ward/area, party/description and elected/not-elected status rather than being flattened into a current biography. |
| electionresults.uk — Ealing | Borough-wide / recent elections | Derived electoral data / analysis | **REFERENCE** | `https://electionresults.uk/councils/ealing`. Provides ward-by-ward recent election cycles and composition history. Its Ealing page documents its provenance: pre-2021 ward results derive from LEAP; newer election data uses House of Commons Library / Democracy Club material; composition history uses Open Council Data. Use as a convenient recent analytical layer while preserving the underlying source attribution. |

## Civic-profile integration

Current Ealing councillor profiles now expose an **Election record** panel linking to both reference sources. The official Ealing Council directory remains the source for the current office-holder role; electoral-history links are additional provenance/discovery layers, not replacements for the official current record.

The first implementation deliberately links to the Ealing-wide source surfaces rather than pretending that a stable per-person identifier exists where one has not yet been verified. A later structured importer can attach individual candidacies and results once candidate matching, boundary-era ward identity and provenance rules are tested.

## Candidate inclusion rule

Election candidacy is an objectively verifiable civic role. A person may therefore be searchable when candidacy is supported by an official election record or a reputable public electoral archive with clear provenance.

That does **not** mean every unsuccessful candidate should automatically receive a permanent browsable profile. The public-people policy remains:

- current elected office-holders qualify for public profiles;
- former elected office-holders may retain historical profiles where useful to civic memory;
- recurring or otherwise civically significant candidates may qualify for a profile where their continuing public role warrants one;
- an otherwise one-off unsuccessful candidate should normally be a dated searchable civic reference rather than a promoted People-directory profile;
- incidental personal information must not be inferred or aggregated merely because a candidate name is public.

This gives Civic Commons a reproducible inclusion test: **electoral participation is discoverable because it is a public civic record, while profile prominence remains a separate editorial and data-minimisation decision.**

## Next structured step

A future electoral-history adapter should model candidacy as dated assertions rather than free-text biography, for example:

- person / candidate identity;
- election date and election type;
- ward or electoral area with boundary-era identifier where available;
- party or ballot description exactly as recorded;
- votes / vote share where available;
- elected / not elected;
- source URL and source provenance;
- confidence / review state for candidate identity matching.

That model can support questions such as “when did this councillor first stand?”, “who has represented this ward?” and “which elections has this person contested?” without turning the Commons into an indiscriminate people database.
