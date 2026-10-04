# Issue discovery and publication boundary

Civic Commons issues are reviewed public civic objects. They gather public records and transparent Commons editorial relationships around a continuing issue or bounded civic event.

## Provenance classes

1. **Public evidence** — public records that may be displayed and linked from Civic Commons, including official publications, planning records, petitions, FOI/EIR material, journalism and other publicly inspectable sources.
2. **Reviewed Commons metadata** — editorial assertions made by Civic Commons, such as an issue's aliases, primary place, related entities and topics. These relationships must be reviewable and should not pretend to be source evidence.
3. **Private discovery material** — unpublished research may suggest candidate issues, aliases, entities, search terms and places to look for public records. It is never itself published, cited, exposed through the API or treated as evidence for a public assertion.

Southall-Zettel is published civic memory and may be a public provider. Southall-Research is private working material and is discovery-only.

**Publication invariant:** private-discovery provenance must never cross the publication boundary.

## Candidate workflow

The intended workflow is:

`private/public discovery signals -> candidate issue -> public-source discovery -> human review -> issue registry -> public issue page`

Candidate discovery should eventually use the Commons' own public corpus as its main signal: recurring named places, organisations and subjects across independent sources; petitions; planning; council records; WhatDoTheyKnow; journalism; and contributions. Private research may help seed candidate searches but must not be required to reproduce or justify a published issue.

Candidate suggestions should remain proposals until reviewed. Useful actions are **Review**, **Ignore** and **Merge with existing issue**.

## Issue registry v2

Canonical issue definitions live in `netlify/lib/issues.json`. Runtime helpers in `netlify/lib/issue-registry.mjs` expose them to the existing civic issue API.

An issue may define:

- `route`, `id`, `name`, `status`, `description`;
- `aliases` for discovery/matching;
- `entityIds` and `topicIds` where corresponding reviewed public identities exist;
- `primaryEntityId` for a Southall-Zettel identity used by the reviewed-memory layer;
- `primaryCivicEntityId` for a Commons-native identity;
- `primaryPlaceRoute` for reviewed place inheritance such as planning context;
- `providers`, which must only name public providers.

The initial v2 batch is Southall Gasworks redevelopment, Walpole Park theatre, Southall data centres, fly-tipping and waste enforcement, Ealing local elections 2026, and Southall RISE protests.

## Next implementation steps

1. Teach the issue API/page assembler to combine reviewed archive material with current Commons records instead of assuming every issue is Zettel-backed.
2. Use `primaryPlaceRoute` as the single reviewed route for inherited planning/place context.
3. Add a candidate-discovery report over the public Commons corpus, with evidence counts and source diversity but no automatic publication.
4. Add validation/tests that reject private provider IDs and malformed/duplicate issue definitions.
5. Add an editorial review surface once the candidate report is useful enough to warrant one.
