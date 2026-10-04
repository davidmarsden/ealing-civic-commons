# Client-side rendering architecture audit

Status: initial audit, 4 October 2026

## Why this audit exists

The Walpole Park place page exposed an architectural failure rather than an isolated feed bug: the correct place-linked Current Commons records can appear briefly and then be replaced by a second renderer. Repeated local fixes have increased the number of browser modules that know about the same page regions.

The immediate rule is therefore: **do not add another Walpole-specific rendering patch. Reduce competing ownership first.**

## Confirmed critical conflict

`#currentSection` / `#currentItems` currently have two independent owners on entity routes.

1. `entity-current-commons.js` loads Current Commons. For places it calls `place-current-records`; for other entities it derives matches from `combined-feed`. It writes the resulting cards directly into `#currentItems`.
2. `site-shell.js` dynamically imports `context-reporting.js` for every `/people/`, `/organisations/`, `/places/`, `/issues/` and `/topics/` route.
3. `context-reporting.js` independently loads `/feed`, independently scores/selects current items, and writes them into the same `#currentItems` container.
4. `context-reporting.js` then installs a `MutationObserver` over its current/reporting roots and re-runs its render when those roots change.

This creates last-writer-wins behaviour. On a place such as Walpole Park, the place-specific renderer can show the richer place-linked set and the generic context renderer can subsequently replace it with its narrower scored feed set. The observer can make that replacement persistent and can cause needless repeated DOM work.

`place-records-ui.js` already contains the correct architectural intent in a comment: Current Commons should be rendered exclusively by `entity-current-commons.js`. That contract is not currently enforced because `context-reporting.js` is injected independently by `site-shell.js`.

## Page bootstrap inventory: entity/place pages

`entity.html` currently loads:

- `site-shell.js`
- `place-brand.js`
- `entity.js`
- `entity-dossier-ui.js`
- `place-records-ui.js`
- `entity-current-commons.js`
- `section-nav-sync.js`
- `election-history.js`
- `entity-evidence.js`
- `entity-issues.js`
- `share.js`

In addition, `site-shell.js` dynamically imports `context-reporting.js` on the same route.

That means an entity page is not bootstrapped by one page controller. It is assembled by a collection of self-starting scripts, several of which wait for, inspect, mutate or repair DOM created by another script.

There is also template drift: `entity.html` and `civic-entity.html` are near-duplicate entity shells with different script/version combinations. In particular the former explicitly loads `entity-current-commons.js`; the latter currently does not. The fallback matters operationally: `social-preview.js` can bypass on error and the Netlify redirects can then serve `civic-entity.html`. Current Commons ownership therefore cannot be removed from `context-reporting.js` until the authoritative renderer is also present in that fallback shell, or the two shells have been consolidated. This makes route/template behaviour harder to reason about and easier to regress.

## MutationObserver inventory

Not every observer is bad. The audit distinguishes **one-shot or idempotent enhancement observers** from **persistent ownership/repair observers**.

### High risk

- `context-reporting.js`: persistent observers re-render Current Commons / historical reporting after child-list changes. This is a state-ownership mechanism disguised as DOM observation and should be removed.
- `explore-issue-hubs.js`: observer re-applies a transformed directory after mutations. Review during Explore refactor; likely another competing-render smell.
- `demo-data.js`: multiple observers coordinate loading/timeline state. Review separately; this is another area where explicit state would be safer.

### Lower risk / one-shot or idempotent compatibility

- `memory-columns.js`: the observer remains connected, but column arrangement is guarded by `grid.dataset.columnsArranged` and becomes a no-op after the first successful arrangement; later mutations can still enhance newly inserted entity tags. This is lifecycle coupling worth simplifying eventually, not evidence of a competing layout-repair loop.
- `place-brand.js`: waits until hero content exists, applies the place mark, then disconnects.
- `election-history.js`: waits for entity hero readiness, renders once, then disconnects.
- `item-connections.js`: waits for the item view to become renderable, then disconnects.
- `entity-evidence.js`: waits for hero actions to exist, synchronises once, then disconnects.

These are still evidence that the page lacks an explicit lifecycle, but they are not currently the same class of infinite ownership conflict.

## DOM ownership matrix

| Region | Current writers / mutators | Assessment | Target owner |
| --- | --- | --- | --- |
| `#entityHero` | `entity.js`; enhancements from brand/evidence/election modules | shared lifecycle, mostly one-shot | entity page controller owns markup; enhancements consume explicit ready state |
| `#currentItems` | `entity-current-commons.js`; `context-reporting.js` | **critical conflict** | one Current Commons controller/renderer |
| `#currentSection` visibility | Current Commons scripts; context reporting; primary-issue logic; nav/UI modules inspect it | conflict / implicit coordination | page state decides visibility once |
| `#reporting` | base entity rendering; `context-reporting.js`; `place-records-ui.js` appends archive records | multiple writers | one historical-reporting renderer fed a merged data model |
| `#reportingSection` visibility | reporting renderers and primary-issue logic | multiple writers | page controller |
| `#planningArchiveItems` | place/planning UI | acceptable if single writer confirmed | planning renderer |
| hero action links | entity renderer plus `entity-evidence.js` and primary-issue logic | repair-after-render pattern | page controller renders final actions from state |
| section navigation | dossier/nav scripts inspect section state | acceptable as consumer, not writer | navigation module consumes page state / rendered sections |

## Data/domain duplication to audit

Walpole Park is represented in several layers:

- `netlify/lib/entity-registry.mjs` — route/entity registration.
- `netlify/lib/civic-institutions.mjs` — civic place record and source metadata.
- `netlify/lib/civic-place-links.mjs` — explicit/contextual discovery rules.

These may represent legitimate separate concerns, but there must be one canonical identity (`civic:place:walpole-park`) and explicit contracts for what each layer owns. Names, aliases, descriptions and routes should not silently drift between registries.

Current-record selection is also duplicated:

- explicit/inferred place links used by `place-current-records`;
- generic term/topic scoring in `context-reporting.js`;
- generic term matching in `entity-current-commons.js` for non-place entities.

The server should own discovery/selection semantics. Browser renderers should receive an already-selected collection rather than independently deciding what belongs to an entity.

## Target architecture

### 1. One page controller

Each route family gets one controller (`entity`, `issue`, `topic`, `item`, etc.). It owns page loading, state and section visibility. Feature modules should export functions rather than self-start and compete for DOM.

Conceptually:

```text
route
  -> page controller
      -> load canonical page model
      -> render hero
      -> render current commons
      -> render planning
      -> render evidence
      -> render historical reporting
      -> render relationships
      -> render navigation from resulting state
```

### 2. One canonical page model

Prefer a server-side composition endpoint, or a small number of explicit loader functions coordinated by the controller. A place page model should contain distinct collections such as:

```text
entity
currentRecords[]
historicalRecords[]
planningRecords[]
evidence[]
relationships[]
issues[]
```

No renderer should fetch an overlapping feed and reinterpret membership after the controller has loaded the canonical collection.

### 3. One writer per region

A DOM root has one owner. Other modules can supply data or pure rendering helpers, but cannot overwrite the root later.

### 4. Explicit lifecycle instead of repair observers

Where enhancements genuinely need rendered content, the controller should call them after rendering or dispatch a narrow render-complete event. MutationObservers must not be used to enforce application state.

### 5. One entity template

Choose `entity.html` or `civic-entity.html` as canonical and remove/redirect/generate the duplicate. Script composition and cache versions must not diverge between two hand-maintained shells. Until consolidation is complete, both shells must load the same authoritative Current Commons renderer before the legacy owner is disabled.

## Refactor plan

### Phase 0 — stop the bleeding

- Do not add new Current Commons patches.
- First ensure `entity-current-commons.js` is loaded by both `entity.html` and the `civic-entity.html` fallback path (or consolidate those shells immediately).
- Only then prevent `context-reporting.js` from owning Current Commons on entity/place routes.
- Remove the persistent Current Commons MutationObserver path.
- Preserve historical reporting behaviour temporarily, but do not let it rewrite Current Commons.
- Add a regression test for Walpole Park: the canonical place endpoint result must remain the displayed result after page settlement.
- Add a fallback-shell regression test so a `social-preview.js` bypass still produces Current Commons rather than an empty section.

Success criterion: Walpole Park no longer flashes the correct set and then reverts, fallback entity pages still have Current Commons, and the page does not enter observer-driven DOM churn.

### Phase 1 — establish ownership

- Extract Current Commons rendering to one module with no self-start side effects.
- Make the entity controller call it.
- Move entity selection/membership to server endpoints.
- Merge place archive additions before historical reporting is rendered rather than appending after another renderer.
- Add ownership comments/tests for every major DOM root.

### Phase 2 — unify page lifecycle

- Replace polling (`waitForEntity`) and one-shot MutationObservers with explicit controller sequencing where they are actually lifecycle workarounds.
- Convert dossier/nav/evidence/issue modules into functions called from the page controller.
- Ensure section navigation derives from the final page model rather than racing section visibility changes.

### Phase 3 — consolidate templates and domain registries

- Remove the `entity.html` / `civic-entity.html` duplication.
- Document canonical entity identity and responsibilities of registry, institution metadata and link/discovery rules.
- Deduplicate route/name/alias metadata where practical.

### Phase 4 — audit the rest of the app

Apply the same ownership test to Explore, demo/timeline, item pages and the main feed. In particular inspect persistent MutationObservers and any script that fetches data merely to overwrite markup rendered by another script. Idempotent enhancement observers such as the current `memory-columns.js` pattern should be treated separately from competing render ownership.

## Architectural guardrails

New code should satisfy all of these:

1. Every major DOM root has one named owner.
2. A feature cannot add a MutationObserver whose purpose is to restore its preferred markup after another feature writes to the same root.
3. Entity membership/discovery rules live server-side or in one shared domain module, not separately in browser renderers.
4. Page bootstrap is explicit and inspectable from one controller.
5. A new feature should normally add data/state or a renderer, not another autonomous page-wide script.
6. Regression tests cover settled page state, not only the first successful render.
7. Fallback shells/routes must preserve the same authoritative renderer before a legacy owner is removed.
8. Refactors should reduce autonomous scripts, duplicate fetches and DOM writers. A fix that increases any of those needs explicit justification.

## First implementation PR

The first implementation should be deliberately small: enforce single ownership of Current Commons without attempting the entire rewrite at once. The safe order is important: first load `entity-current-commons.js` in the `civic-entity.html` fallback (or consolidate the shells), then stop `context-reporting.js` from rendering/observing `#currentItems`. `entity-current-commons.js` can then be the temporary sole owner across both normal and fallback entity paths. Verify Walpole Park, the fallback path, and representative person/organisation/place pages before proceeding to the controller refactor.

This is an architectural repair programme, not another sequence of Walpole-specific patches.