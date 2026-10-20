# SocialSpec integration — architecture audit and staged delivery

Status: proposed; no production behaviour changed by this document.

## Existing capabilities verified (21 October 2026)

- `package.json` builds a static `dist` by copying `public/.`, then running asset and social-card generation.
- `netlify.toml` serves static files and rewrites civic entity routes.
- The README documents a source register, browser-local follows for sources/stories/places/topics, portable personal RSS and email alerts.
- Current Chat subscription/identity internals have **not** yet been inspected. No claims of compatibility are made.

## Boundaries and ownership

1. The existing source registry remains canonical. SocialSpec metadata is optional enrichment; never overwrite reviewed source metadata automatically.
2. The existing follow identifiers remain canonical for personal follows. A curated public OPML is **not** an export of private browser-local follows.
3. The public website's about/contact documents describe the Commons organisation, not individual contributors. Publish only an explicitly approved contact address.
4. No third-party profile data is trusted as HTML or as authority to merge identities.
5. No second renderer, feed collector, follow store, or periodic crawler should be introduced.

## Phase 1 — Civic Commons publishing (first implementation PR)

- Confirm the current SocialSpec specification and Micro.blog interoperability before implementing endpoint names and format.
- Add a single generator using reviewed site metadata and an explicit curated list of public sources.
- Publish `/.well-known/about.md`, `/.well-known/contact.vcf` (only once a public contact address is approved), and `/.well-known/following.opml`.
- Publish a canonical, site-wide RSS/Atom or JSON Feed at `/feed.xml` or `/feed.json` for approved **public** Commons items. The existing aggregation JSON API and browser-local personal RSS endpoints are not substitutes for a standard public posts feed. Determine whether a suitable public feed already exists before adding a generator, and reuse the canonical public-item selection and stable URLs rather than creating a parallel ingestion pipeline.
- Validate the public feed's schema, MIME type, CORS headers, absolute canonical links, stable IDs, and exclusion of private submissions or unpublished items. Include its discovery link in the site's HTML where appropriate.
- Do **not** derive public following lists from user browser storage or all ingested sources.
- Ensure static Netlify serving takes precedence over wildcard rewrites; specify appropriate Content-Type and permissive read-only CORS headers where required by the specification.
- Add fixture-based tests for XML escaping, vCard escaping, Markdown safety, no personal contact leakage, MIME types, and deterministic output.
- Include validation using a SocialSpec checker, and a deploy-preview smoke test.
- Keep deployment opt-in until content and contact details are approved.

## Phase 2 — Read-only source discovery

- Extend the existing source adapter pipeline to probe SocialSpec metadata for *registered* domains, not arbitrary user-supplied URLs.
- Enforce SSRF protections: HTTPS only; reject loopback/private/link-local addresses, unsafe redirects, and excessive response size; use timeouts and bounded concurrency.
- Record candidate fields and provenance separately from approved canonical source metadata.
- Never automatically create source records, change canonical URLs, or publish contact details.
- Surface proposed updates for human review. Failed probes must not block ordinary feed ingestion.

## Phase 3 — Commons Chat audit and interoperability

Inspect the rss.chat fork before implementation:
- Account identity, feed subscription storage, and follow/unfollow APIs.
- Existing OPML import/export, deduplication and subscription semantics.
- Whether a curated collection can be offered without impersonating a user's personal follows.
- Privacy implications of exposing user following lists.
- Cross-origin permissions, authentication boundaries and mobile/PWA behaviour.

Only then design a separate Chat PR for voluntary subscription to curated Commons source collections. SocialSpec does **not** provide federation, authentication or messaging by itself.

## Acceptance criteria

- No duplicated canonical registry or follow persistence.
- No changes to Current Commons rendering.
- No private user follow or unpublished research data exposed.
- Existing build/tests remain green.
- Static endpoints, including the canonical public posts feed, independently testable and reversible.
- Source discovery is advisory and human-reviewed.
- Chat integration requires its own audited PR.

## Recommended next change

Implement Phase 1 as a separate, narrow PR after confirming the live specification and selecting the approved public contact details and curated sources. Do not auto-publish `contact.vcf` with a guessed address.
