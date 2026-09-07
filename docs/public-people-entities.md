# Public people entities — publication, discovery and minimisation policy

**Status:** working governance rule for the Ealing Civic Commons reference implementation  
**Applies to:** public person profiles, search references, Explore results, issue/entity relationships and future imports into the civic graph

Civic Commons is not a people-search database. A person being named in a public article, meeting paper, campaign page or research note does **not** by itself justify creating or publishing a standalone Civic Commons profile.

At the same time, useful civic discovery should not require every significant person to have a permanent profile. The Commons therefore distinguishes three levels of visibility.

## 1. Public profile

A person may have a browsable standalone profile where identifying their **documented public civic role** materially helps readers understand local government, public institutions, civic organisations, campaigns or an ongoing civic issue.

A profile may be appropriate for:

1. **Public office-holders** — for example councillors, MPs, London Assembly Members, mayors or other elected/appointed public office-holders.
2. **Official institutional representatives** — for example a council officer acting publicly in a named role, headteacher, chief executive, chair, spokesperson or faith/community leader whose public-facing role is relevant to the Commons.
3. **Sustained public civic actors** — campaigners, organisers or activists with a documented, continuing public role independently relevant to a civic issue.
4. **Historical civic actors** — where a past public role is necessary to understand civic history and is clearly dated and described as historical.

For non-office-holders, the profile threshold should be role-based and reproducible rather than based on familiarity or notoriety. A first-party or authoritative source should identify the person in a current formal leadership, representative or sustained campaign-organising role. Ordinary trustees, members, volunteers, generic contacts and one-off speakers do not qualify automatically.

Election candidates are handled differently. **Every officially recorded Ealing Council candidacy in the same election is treated consistently as a dated civic role.** Unsuccessful candidacy on its own does not create a permanent public profile or make someone prominent in People browse. Instead, an official candidate record may be returned in an active name search, with the ward, party description, election date and official result source. Candidates who are elected are already represented by their public-office profile.

For historical elections, a reputable public electoral archive may also support a dated candidacy record where it exposes clear source provenance. That does not replace an available official source for current elections, and it does not lower the threshold for creating a permanent public profile.

The same threshold applies to people who build, publish, research or contribute to Civic Commons. Being a project founder, publisher or contributor is not by itself a reason for a standalone profile, and the Commons should avoid giving its own participants greater prominence than comparable local civic actors.

## 2. Civic reference — searchable, not a profile

Some people matter to the public record without meeting the threshold for a standalone Civic Commons biography.

A **civic reference** may therefore appear when a reader searches for a person's name if that person recurs materially across reviewed civic reporting, source records or reviewed relationships. A civic reference:

- is returned only in an active name search, not in the default People browse view;
- does not create a `/people/...` profile route;
- does not aggregate a biography, personal details or inferred affiliations;
- is clearly labelled **Reference, not profile**;
- points readers back to a small number of public records showing why the name is relevant.

The reference implementation requires at least **two reviewed civic records or relationships** before a research-only person can appear this way. This is a minimum discovery threshold, not a claim that the person holds office or has any particular status.

Official election-candidate records are a separate reference subtype. They do not need the two-record research threshold because the candidacy itself is an explicit public civic role in an authoritative election record. A single verified historical candidacy from a reputable electoral archive with explicit provenance may be treated the same way. These records remain search-only unless another documented role independently justifies a profile.

This layer is intended for cases such as recurring election candidates, voluntary-sector figures, campaign organisers or other named civic participants whose presence in the public record is useful to find but does not yet justify a full profile.

## 3. Incidental mention — not indexed as a person

Do not create a profile or search reference merely because someone is:

- named once in an article, submission, petition, minutes or public document;
- a resident who gave a quote or objection;
- a one-off meeting attendee;
- an ordinary volunteer or member of a community organisation;
- listed as a generic contact person;
- present in the research graph without enough reviewed civic context to justify discovery.

The canonical source may still contain that person's name. Civic Commons does not need to amplify every public mention into either an aggregated profile or a searchable person record.

## Required fields for public profiles

Every deliberately published person profile should be able to answer, in plain English, **“Why does this person have a Civic Commons profile?”**

At minimum it should have:

- a stable public identity;
- a concise `publicRole` or equivalent description of civic standing;
- provenance for that role;
- current/historical status where relevant;
- a first-party or authoritative source/website where one exists.

Political party, faith, ethnicity, health, sexuality and other sensitive or identity-related attributes must not be inferred from context. Record affiliations only when they are explicitly public, relevant to the civic role and supported by an appropriate source. Election-party descriptions are copied only from the electoral record because they are part of the candidacy being indexed, not inferred from later activity.

## Searchability is not prominence

Being discoverable by name is different from being promoted in a directory. Explore therefore keeps broad person discovery **search-first**:

- People browse contains public profiles only and is bounded rather than an ever-growing tag cloud;
- typed name search can additionally return civic references and dated official candidate records;
- incidental names remain outside the person index.

This preserves the useful connections of the civic graph without turning it into a list of everyone who has ever appeared in local reporting.

## Current versus historical roles

Roles should be time-bounded where possible. Former councillors, former chairs or previous organisational representatives should not be rendered as if they remain current. Historical profiles can remain part of civic memory when their past role continues to matter.

Election candidacies are always time-bounded to the election in which the person stood. A later election creates another dated candidacy record rather than silently turning the old role into a current affiliation. Electoral area and boundary era should be preserved where known; similarly named wards must not be silently collapsed across boundary changes.

## Removal, correction and review

A public profile is a reviewed editorial choice. A civic reference is a deliberately limited discovery aid. Neither is an automatic consequence of ingestion.

If the justification becomes unclear, a profile can be downgraded to a reference or removed from public discovery; a reference can be removed without erasing the underlying canonical source material.

The data-minimisation principle is simple: **make civic roles and public records discoverable without publishing more about a person than readers need.**
