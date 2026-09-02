# Rich civic source audit

Updated: 2 September 2026

Some civic websites are poor fits for a simple RSS-or-page-watch model. A source can be technically “live” while its most useful historical reporting, campaign chronology, evidence pages or documents never become durable Civic Commons memory.

This audit classifies five high-value sources by the public surfaces they actually expose and records the ingestion treatment that best matches each one.

## Source model

Use four complementary modes rather than forcing every source into a feed:

1. **Dated structured archive** — discrete first-party posts with stable URLs and publisher dates. Emit normal Commons items and archive the wider listing directly, outside the 220-item combined-feed cutoff.
2. **Living publication** — an undated or continuously edited page. Store versioned/content-hashed snapshots; do not invent dates.
3. **Evidence collection** — stable campaign chronology, reports, FOIs, submissions, policies or documents. Preserve as source/evidence material even where it is not appropriate to project each link into the live timeline.
4. **Reference identity** — a useful first-party organisation/service page with little or no publication stream. Keep it canonical for graph identity and evidence without manufacturing “news”.

A single source may use more than one mode.

## Warren Farm Nature Reserve

Canonical site: https://www.warrenfarmnaturereserve.co.uk/

### What is there

- A stable dated blog archive at `/blog`, with posts running back through the Warren Farm campaign period.
- A substantial `Campaign, Petition & Press` page containing the campaign case, chronology, links to council/media material and updates.
- Stable background pages for the campaign vision, wildlife, supporter statements and Warren Farm history.

### Treatment

- **Dated structured archive:** yes — blog posts are first-party, dated, canonical items.
- **Living publication / evidence:** yes — the campaign/press chronology should be monitored as a living evidence page rather than misattributing the third-party articles it links to as Warren Farm publications.
- **Historical archive:** priority. Older blog items must bypass the live combined-feed cutoff so they can become Civic Archive material.

### Implementation in this change

`rich-source-feed.mjs` extracts the dated blog archive and exposes a small recent subset to the live Commons while returning the wider parsed set to `item-archive.mjs` for direct archival.

## Southall Black Sisters

Canonical site: https://southallblacksisters.org.uk/

### What is there

- A large dated News archive (currently 26 pages) with stable article URLs and content types including news, campaigns, opinion, editorials, events and press releases.
- A separate dated `Submissions & Campaigns` archive containing policy analysis, submissions, evaluations, campaign material and accountability work.
- Existing Commons video coverage does not capture this first-party written archive.

### Treatment

- **Dated structured archive:** yes — both News and Submissions & Campaigns.
- **Evidence collection:** yes — especially formal submissions, evaluations and accountability reports.
- **Video:** retain existing selective YouTube integration as a separate media surface.

### Implementation in this change

Both dated website archives are added to `rich-source-feed.mjs`. The live Commons receives only a small recent subset; the wider parsed listing is sent directly to the Civic Archive so valuable older first-party material is not lost merely because it is outside the live-feed window.

## Ealing Friends of the Earth

Canonical site: https://www.ealingfoe.org.uk/

### What is there

- A Google Sites homepage whose `News` section contains multiple current stories embedded in one evolving page rather than consistently separate dated permalink posts.
- `Coming Up`, petitions/actions and campaign material on the same site.
- A linked archived predecessor site for older posts.

### Treatment

- **Living publication:** yes — current News is already correctly handled by a content-hashed living-page watch.
- **Evidence/archive follow-up:** yes — audit the linked old-site archive separately rather than pretending the current page is a conventional feed.
- Do not manufacture publication dates from page order.

### Current conclusion

The existing living-page model is appropriate. The next useful enhancement is historical ingestion of the explicitly linked predecessor archive, not a new current-news scraper.

## The Monitoring Group

Canonical site: https://tmg-uk.org/

### What is there

- Long-lived organisational/campaign pages with deep historical context.
- Current news and project material embedded across living pages, including `The Drum` and newer homepage sections.
- Stable campaign/history/project links and occasional downloadable material.

### Treatment

- **Living publication:** yes — retain the current versioned `The Drum` watch.
- **Evidence collection:** yes — campaign/history/project pages are more valuable as durable civic evidence than as synthetic timeline stories.
- **Structured dated archive:** not yet demonstrated consistently enough to replace the living-page model.

### Current conclusion

Keep `The Drum` living-page integration. Add evidence-page monitoring/indexing in a later source-evidence pass rather than building a brittle fake article feed.

## Ealing Law Centre

Canonical site: https://ealinglawcentre.org.uk/

### What is there

- Stable first-party service and legal-information pages covering housing, immigration, welfare rights and related support.
- Organisational reports/policies including a 2019 Review and policy statements.
- No obvious durable current-news or dated publication archive on the present site.

### Treatment

- **Reference identity:** yes.
- **Evidence collection:** yes — reports, policies and legal-information pages can support graph/evidence relationships.
- **Live publication feed:** no, unless a stable updates surface appears later.

### Current conclusion

Do not invent a news stream. Keep Ealing Law Centre as a verified reference source and promote its reports/policies into evidence when relevant.

## Operational rule discovered by this audit

The scheduled archive previously depended on the combined feed, which is intentionally capped to keep the live Commons usable. That meant an old but valuable structured source could be configured correctly yet still never reach the Civic Archive.

Rich structured sources now return two views:

- `items` — a small recent subset suitable for the current timeline;
- `archiveItems` — the wider parsed dated set, archived directly by the scheduled item archive.

This separates **discovery** from **memory**. A source no longer has to remain recent enough to survive the live-feed cutoff in order to become historical civic context.

## Next candidates for this model

Apply the same audit before adding bespoke parsers to other high-value sources. In particular:

- first-party faith/community sites with selective civic publishing;
- campaign sites with FOI/document chronologies;
- organisations whose current homepage is a living publication but whose older site exposes a proper archive;
- source sites where reports/submissions are more important than “news”.

The default remains conservative: preserve canonical publisher URLs, fail closed when structure changes, distinguish publisher material from third-party links, and never invent dates or reviewed relationships.
