# Southall & Ealing Civic Commons
## Open Social Phase — development direction

**Date:** 26 August 2026  
**Updated:** 20 September 2026  
**Status:** Implementation history; Commons Chat is now live

The Civic Commons can begin developing its social and participatory layers now, while conversations and integrations with Open Council Network, Ealing Council, RSS.chat and other potential partners continue in parallel.

Those relationships can make the Commons substantially better. They are complementary to the work already under way rather than prerequisites for the next development stage.

## September 2026 update — Commons Chat is live

The proposed open conversation layer now has a working implementation.

Commons Chat uses the open-source RSS.chat client/server as a separate, replaceable conversation service. Civic Commons item pages can start or discover discussions; bound chat roots carry the canonical Civic Commons object URL/type; the same binding is emitted in RSS; replies remain ordinary RSS.chat replies rather than duplicate civic records.

The live implementation preserves RSS.chat's public user/everyone feeds, HTTP API and websocket stream. Local server changes are maintained as a reproducible repository overlay instead of undocumented production edits.

Micro.blog is the first verified external publishing bridge: after connecting an account to the Commons Chat host by email verification, a Micro.blog post can be sent with **Cross-post… → RSS chat**. The canonical blog/article remains the publication of record; Commons Chat carries the conversational copy.

Micro.blog can also cross-post its sources to wider networks including Bluesky and Mastodon, so it gives us a practical bridge to test before attempting native ActivityPub or AT Protocol federation. Native two-way Commons Chat federation with those networks is **not** claimed today.

See [Commons Chat — architecture and interoperability](./commons-chat-architecture.md).

## Principle

> **Participation should be native to the Commons, while identity and publishing remain portable.**

The social layer should therefore be built so that external services can connect to it without the Commons depending on any single service.

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

Each Commons item can expose a conversation thread keyed to its stable item ID. RSS.chat now provides that first working conversation layer, while the storage/interface remains replaceable so ActivityPub, AT Protocol or other open integrations can later mirror or participate without owning the civic record.

The first implementation has therefore proved the user experience without requiring federation.

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

**Social Phase C — partly live**
- RSS.chat / Commons Chat bridge live, including civic-object binding and public open feeds/API;
- Micro.blog manual cross-posting into Commons Chat verified;
- test feed-based bridges through Micro.blog to Bluesky/Mastodon before considering native federation;
- portable identity where practical;
- external replies/contributions mapped back to Commons item IDs only where identity/thread mapping is reliable.

**Parallel democracy integration**
- continue exploring Open Council Network integration as access and terms are agreed;
- continue working with Ealing Council/ModernGov on reliable access to official democratic publishing;
- develop Social Phases A and B alongside those integrations.

## Why this matters

The read-only timeline proves that Ealing already has a distributed civic information ecosystem. The social phase turns discovery into participation: residents can follow an issue, add evidence, connect sources, correct mistakes and discuss material without surrendering the underlying civic record to a commercial social network.

A stronger public prototype should also make partnership discussions easier. OCN, Ealing Council and local publishers will be able to see and shape a functioning civic network as it develops.

## Constitutional constraint

Core participation should remain portable and resilient rather than becoming dependent on any single external integration.

If a provider later disappears, changes its pricing, alters access or changes direction, the Commons should retain its public URLs, source provenance, subscriptions, contributions and civic relationships.

**Publish anywhere. Connect locally. Participate openly.**
