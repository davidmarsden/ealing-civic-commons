# Civic Commons evidence object

**Status:** Design draft  
**Date:** 31 August 2026

The Ealing Data probe proved that Civic Commons can turn Ealing Council's public InstantAtlas/ArcGIS catalogue into trustworthy local evidence, but the probe deliberately renders source-specific data directly. This document defines the next layer: a stable, source-agnostic evidence object that can be attached to civic items, places, topics and documents without baking Ealing Data quirks into the rest of the application.

## Design principles

1. **Evidence is not editorial.** Store what a source publishes, plus provenance and interpretation limits. Editorial claims belong elsewhere.
2. **Geography is explicit.** Never infer that data stored on an LSOA-shaped service is LSOA-level evidence. The published geographic scope must be recorded separately from the technical source layer.
3. **No synthetic aggregation by default.** Ward/Town values are only used when directly published, unless a later transformation explicitly records its method.
4. **Comparators are first-class evidence.** A number without context is usually not useful. Comparators must use the same measure, period and compatible geography.
5. **Method limits travel with the value.** Monitor uncertainty, modelled/background status, flat repeated values, boundary changes and other caveats are part of the evidence object rather than presentation-only warnings.
6. **Source remains canonical.** Civic Commons stores a normalized evidence record and source pointers, not a substitute authoritative dataset.
7. **Stable identity before presentation.** The same evidence object should be reusable on a story page, place page, topic page, map, feed card or later API.

## Proposed object

```json
{
  "schemaVersion": 1,
  "id": "ealing-data:I3091:2025:LSOA21:E01001292",
  "kind": "statistic",
  "indicator": {
    "id": "I3091",
    "name": "Index of Multiple Deprivation (IMD) Score",
    "theme": "Deprivation / IMD",
    "dataType": "score",
    "unit": null
  },
  "value": 19.948,
  "period": {
    "label": "2025",
    "start": null,
    "end": null
  },
  "geography": {
    "level": "LSOA 2021",
    "code": "E01001292",
    "name": "Ealing 014D",
    "ward": "Dormers Wells",
    "town": "Southall",
    "scope": "neighbourhood"
  },
  "comparators": [
    {
      "label": "Ealing LSOA median",
      "value": 24.1,
      "geographyLevel": "LSOA 2021",
      "population": 199,
      "method": "median"
    }
  ],
  "provenance": {
    "publisher": "Ealing Council",
    "sourceSystem": "Ealing Data / InstantAtlas / ArcGIS",
    "indicatorUrl": "https://data.ealing.gov.uk/data-catalog-explorer/indicator/I3091/",
    "serviceUrl": "https://services1.arcgis.com/.../FeatureServer/6",
    "fieldId": "ID3091D20250101000000",
    "retrievedAt": "2026-08-31T00:00:00.000Z"
  },
  "methodology": {
    "publicationScope": "LSOA 2021",
    "measurementType": "unknown",
    "aggregation": "direct-published-value",
    "warnings": []
  },
  "relationships": {
    "towns": ["Southall"],
    "wards": ["Dormers Wells"],
    "topics": ["deprivation"]
  }
}
```

## Geography model

`geography.level` is the geography of the **published observation**, not necessarily the ArcGIS layer that happened to carry it.

Suggested levels:

- `Ealing borough`
- `Town Profile`
- `Ward`
- `MSOA 2021`
- `LSOA 2021`
- later: constituency and other official geographies where directly supported

`geography.scope` is a semantic helper for presentation and relationships, initially:

- `borough`
- `town`
- `ward`
- `neighbourhood`

For Southall, the current town evidence scope is the six wards Dormers Wells, Lady Margaret, Norwood Green, Southall Broadway, Southall Green and Southall West. Hanwell Broadway, Northfield and Walpole are constituency context only and must not silently enter Southall town statistics.

## Evidence collections

A page normally needs a collection rather than one object. A collection groups compatible observations for one indicator and period:

```json
{
  "schemaVersion": 1,
  "id": "ealing-data:I3091:2025:southall",
  "indicatorId": "I3091",
  "period": "2025",
  "place": "Southall",
  "observations": ["ealing-data:I3091:2025:LSOA21:E01001292"],
  "summary": {
    "count": 40,
    "min": 19.948,
    "median": 32.702,
    "max": 48.834
  },
  "comparator": {
    "label": "Ealing LSOA median",
    "population": 199,
    "method": "median",
    "value": 24.1
  }
}
```

Collections are where maps, distributions and summary graphics should normally be generated. Raw evidence objects remain simple and individually source-checkable.

## Methodology flags

The probe exposed several cases that should become explicit flags rather than ad-hoc UI logic.

Suggested warning codes:

- `flat-spatial-values` — all selected areas carry the same published value
- `narrow-spatial-range` — variation is very small compared with the wider comparator range
- `measurement-method-unknown` — source endpoint does not identify measured vs modelled/background methodology
- `monitor-location-unknown` — relevant for air-quality measures where monitor location/type is not supplied
- `borough-value-repeated-on-small-area-layer` — technical service repeats one borough value across smaller-area rows
- `historic-boundary-mismatch` — periods use incompatible geography boundaries, e.g. IMD 2015/2019 vs LSOA 2021
- `source-metadata-incomplete`

Warnings should carry optional human-readable text but use stable machine codes for filtering and presentation.

## Comparator rules

A comparator is valid only when:

- indicator and unit are the same;
- time period is the same or explicitly documented;
- geography is compatible;
- aggregation method is recorded;
- the comparator population size is known where calculable.

The current probe therefore uses:

- 40 Southall LSOAs vs 199 Ealing LSOAs;
- six Southall wards vs 24 Ealing wards;
- Southall Town Profile vs seven Ealing Town Profiles.

A national or London comparator can be added later when the source provides a genuinely comparable measure; it should not be inferred merely because a national figure with a similar title exists.

## Borough-only evidence

The core-homelessness example is the guardrail case. Although its field is present on an LSOA-shaped service, the same value is repeated across Ealing. The production normalizer should emit **one borough-scoped evidence object**, not 199 pseudo-LSOA objects.

Detection may use source-specific rules plus repeated-value diagnostics, but the resulting normalized object must state:

```json
{
  "geography": { "level": "Ealing borough", "scope": "borough" },
  "methodology": {
    "warnings": ["borough-value-repeated-on-small-area-layer"]
  }
}
```

## Air quality

Air-quality evidence needs stricter treatment than ordinary statistical indicators.

The Ealing Data endpoint currently exposed by the probe does not establish monitor location, monitor type, or whether values are measured, modelled or ambient/background estimates. Therefore:

- never call these values "local monitor readings" without additional source evidence;
- preserve `measurementType: "unknown"`;
- attach monitor/method warnings;
- scale choropleths against an external same-geography comparator range rather than stretching tiny Southall differences;
- suppress hotspot-style language when the source does not justify it.

A later adapter may enrich the object with monitoring-station provenance from a separate authoritative source, but that should be an explicit evidence relationship rather than silently rewriting the original record.

## Storage and identity

Initial production storage can use Netlify Blobs, following the existing persistent civic item model.

Suggested stores/keys:

```text
civic-commons-evidence

evidence/{stableEvidenceKey}
collection/{stableCollectionKey}
```

Stable IDs should be deterministic from source + indicator + period + geography code, not from ArcGIS `OBJECTID`, `FID` or other layer-local identifiers.

The original source row/service pointer remains in provenance so the record can be revalidated.

## Relationships

Evidence should be attachable without being copied into civic items.

Potential relationship edges:

```text
item -> evidence collection
place -> evidence collection
topic -> evidence collection
document -> evidence collection
```

For example a housing story tagged `Southall` and `overcrowding` could display a current overcrowding evidence collection while retaining the source story as a separate civic item.

## Refresh and change handling

Evidence is more stateful than RSS. The adapter should therefore preserve both stable identity and retrieval history.

A later ingestion implementation should record:

- `retrievedAt`
- source period/version
- value hash
- first seen / last seen
- superseded-by relationship where a publisher revises a value

Do not silently overwrite a materially changed evidential value without retaining enough information to explain that a revision occurred.

## Phase 3 implementation boundary

The first production implementation should stay deliberately small:

1. define JSON-schema validation for evidence objects and collections;
2. normalize the same probe set into that schema;
3. write/read evidence from a dedicated store;
4. expose one read-only evidence API;
5. render one reusable evidence component against normalized objects;
6. keep the experimental `/ealing-data-probe.html` page until the normalized implementation reproduces its safeguards.

Do **not** yet ingest the full 16,897-indicator Ealing catalogue. Production starts with the curated probe set and expands only when the normalization and methodology rules are proven.