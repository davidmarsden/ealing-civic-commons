# Southall & Ealing Civic Commons
## Open Social Phase — development direction

**Date:** 26 August 2026  
**Status:** Active development direction

The Civic Commons should not wait for Open Council Network, Ealing Council, RSS.chat or any other external partner before developing its social and participatory layers.

Those integrations can make the Commons better. They must not become gates.

## Principle

> **Participation should be native to the Commons, while identity and publishing remain portable.**

The social layer should therefore be built so that external services can connect to it rather than own it.

## What we can build now

### 1. Stable item permalinks

Every ingested item should have a stable Commons URL as well as its canonical original-source URL. Conversation can attach to the Commons representation without replacing the publisher's page.

### 2. Follow / subscribe

People should be able to follow:
- Southall or another town;
- a topic;
- a source;
- eventually a ward, committee, development or civic issue.

Initial outputs can be RSS/Atom and browser-local subscriptions before accounts exist.

### 3. Reactions without engagement ranking

Simple civic signals such as `useful`, `needs context`, `follow this` or `I have evidence` can be explored without turning popularity into ranking. Chronological ordering remains the default.

### 4. Contributions and replies

A lightweight contribution model can begin before full accounts:
- submit a source;
- submit a correction;
- submit a related link/document;
- contribute a short comment or local observation;
- flag a relationship between two civic items.

Submissions should retain provenance and moderation state.

### 5. Conversation threads

Each Commons item can expose a conversation thread keyed to its stable item ID. The storage/interface should be replaceable so that a future RSS.chat, ActivityPub, AT Protocol or other open integration can mirror or participate in the same thread.

The first implementation does not need federation to prove the user experience.

### 6. Portable open outputs

Conversation and subscription data should have exportable representations wherever practical. The Commons should aim to expose feeds/APIs rather than trap participation in a proprietary database.

## Minimal data model

```text
profiles
- id
- display_name
- optional homepage
- created_at

contributions
- id
- item_id
- profile_id / anonymous attribution
- type: comment | correction | related_link | evidence
- body
- url
- status: pending | published | rejected
- created_at
- provenance

subscriptions
- id
- subject_type: town | topic | source | item
- subject_id
- delivery_type: browser | rss | email

relationships
- from_item_id
- to_item_id / external_url
- relationship_type
- submitted_by
- moderation_status
```

## Moderation and trust

The Commons is civic infrastructure, not an unmoderated message board.

Early participation should therefore be deliberately constrained:
- human review for anonymous/community submissions;
- clear correction and moderation policies;
- source and author attribution;
- no anonymous popularity scores;
- no engagement-based ranking;
- no behavioural advertising;
- no requirement to join a closed social network.

## Development sequence from here

**Social Phase A — now**
- stable item pages/permalinks;
- follow/subscribe controls;
- correction / related-source / evidence submissions;
- basic item discussion UI behind moderation;
- open representation of threads and subscriptions.

**Social Phase B**
- lightweight profiles/accounts;
- notifications;
- town/topic/source following;
- contributor history and moderation tools.

**Social Phase C**
- federation/bridges to open conversation systems such as RSS.chat, ActivityPub or AT Protocol where useful;
- portable identity where practical;
- external replies/contributions mapped back to Commons item IDs.

**Parallel democracy integration**
- Open Council Network integration when terms/access are agreed;
- Ealing Council/ModernGov ingestion when technically available;
- neither blocks Social Phases A or B.

## Why this matters

The read-only timeline proves that Ealing already has a distributed civic information ecosystem. The social phase turns discovery into participation: residents can follow an issue, add evidence, connect sources, correct mistakes and discuss material without surrendering the underlying civic record to a commercial social network.

That stronger public prototype should also make partnership discussions easier. OCN, Ealing Council and local publishers will be able to see a functioning civic network rather than an abstract proposal waiting for their involvement.

## Constitutional constraint

No external integration should become indispensable to core participation.

If one provider disappears, changes its pricing, blocks access or changes direction, the Commons should retain its public URLs, source provenance, subscriptions, contributions and civic relationships.

**Publish anywhere. Connect locally. Participate openly.**
