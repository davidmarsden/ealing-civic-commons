# Civic Commons personal RSS

**Status:** Social Phase B2 working model  
**Date:** 29 August 2026

Personal RSS turns browser-local Civic Commons follows into a portable standards-based feed without creating an account.

## Core principle

The subscription definition lives in the RSS URL itself.

A feed can contain repeated query parameters for the stable follow identifiers introduced in Social Phase B1:

- `item` — stable Civic Commons item key;
- `source` — ingestion source ID;
- `town` — canonical civic place label;
- `topic` — canonical topic label.

Example shape:

```text
/.netlify/functions/personal-feed?source=ealing-matters&town=Southall&topic=Housing
```

Matching uses the same OR semantics as the browser Following view: an item is included when it matches any followed target.

## Portability

There is no server-side profile behind the URL. A standards-based feed reader can poll the URL directly.

Changing the browser's follows creates a new feed URL. Existing subscriptions continue to represent the follow set encoded in the URL they were given.

This is intentional: the feed remains understandable, copyable and independent of a Civic Commons account system.

## RSS entries

The personal feed contains two kinds of chronological entries:

1. source items matching the followed item/source/place/topic targets;
2. approved Civic Commons contributions attached to followed or otherwise matching item threads.

Source-item links point to the stable Commons item page, where the canonical original source remains prominent.

Approved contribution entries use their stable contribution ID as the RSS GUID and link directly to the contribution anchor on the Commons item page. This makes `Follow this story` useful for later corrections, evidence, related sources and local information rather than merely saving the original item once.

## Privacy

The URL contains only civic follow identifiers. It does not contain a name, email address, browser ID or account identifier.

However, a personal RSS URL is **not secret**. Anyone who receives the URL can inspect its parameters and infer the stories, sources, places or topics represented by it. The UI says this explicitly before users copy or share the URL.

## Persistent civic items

Normalized source items are copied into a site-wide Netlify Blobs store on a 15-minute schedule. The existing stable item key is the archive key, so adding persistence does not change item URLs, thread IDs, contribution IDs or follow parameters.

A directly followed story is now loaded from the persistent store when it has fallen out of the live ingestion window. This means its original Civic Commons RSS entry and title context for later approved contributions remain available.

Source, place and topic follows still use the current live window for discovery of new source items. This is intentional for the first persistent-store iteration: feed readers retain entries they have already received, while the Commons archive provides durable lookup for individual civic objects. A later query/index layer can expose broader historical source/topic timelines without changing the subscription model.

## No engagement ranking

Entries are sorted by publication date. The feed does not use likes, popularity, click-through or engagement ranking.
