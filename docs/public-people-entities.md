# Public people entities — publication and minimisation policy

**Status:** working governance rule for the Ealing Civic Commons reference implementation  
**Applies to:** public person entities, Explore results, issue/entity relationships and future imports into the civic graph

Civic Commons is not a people-search database. A person being named in a public article, meeting paper, campaign page or research note does **not** by itself justify creating or publishing a standalone Civic Commons profile.

The purpose of a public person entity is narrower: to explain a person's **documented civic role** where identifying that role materially helps readers understand local government, public institutions, civic organisations, campaigns or an ongoing civic issue.

## Publication threshold

A person may appear as a browsable public entity when at least one of these applies and the role is supported by a first-party or authoritative source:

1. **Public office-holder** — for example a councillor, MP, London Assembly Member, mayor or other elected/appointed public office-holder.
2. **Official institutional representative** — for example a council officer acting publicly in a named role, headteacher, chief executive, chair, trustee, spokesperson or faith/community leader whose public-facing role is relevant to the Commons.
3. **Sustained public civic actor** — a campaigner, organiser or activist with a documented, continuing public role that is independently relevant to a civic issue, rather than someone merely quoted or present at an event.
4. **Historical civic actor** — where the person's past public role is necessary to understand civic history and is clearly dated and described as historical.

## Do not create a standalone public profile merely because someone is

- named in an article, submission, petition, minutes or public document;
- a resident who gave a quote or objection;
- a one-off meeting attendee;
- a volunteer or member of a community organisation;
- listed as a generic contact person;
- present in the private/research graph without an independently justified public civic role.

The canonical source may still contain that person's name. Civic Commons does not need to amplify every public mention into an aggregated profile.

## Required fields for public people

Every deliberately published person entity should be able to answer, in plain English, **“Why is this person in a civic directory?”**

At minimum it should have:

- a stable public identity;
- a concise `publicRole` or equivalent description of civic standing;
- provenance for that role;
- current/historical status where relevant;
- a first-party or authoritative source/website where one exists.

Political party, faith, ethnicity, health, sexuality and other sensitive or identity-related attributes must not be inferred from context. Record affiliations only when they are explicitly public, relevant to the civic role and supported by an appropriate source.

## Current versus historical roles

Roles should be time-bounded where possible. Former councillors, former chairs or previous organisational representatives should not be rendered as if they remain current. Historical entities can remain part of civic memory when their past role continues to matter.

## Removal, correction and review

A public person entity is a reviewed editorial choice, not an automatic consequence of ingestion. If the public-role justification becomes unclear, the entity should be removed from public discovery or returned for editorial review without erasing the underlying canonical source material.

The data-minimisation principle is simple: **publish the civic role that readers need, not every personal detail the system happens to know.**
