# Ealing Data catalogue reconnaissance

Ealing Council's public Data Explorer is an InstantAtlas/ArcGIS application. The visible website does not advertise an API, but its public application configuration exposes a master catalogue table which points to the underlying ArcGIS services used by individual indicators.

## Discovered public configuration

- Ealing Data Explorer: <https://data.ealing.gov.uk/data-catalog-explorer/>
- Data Explorer app ID: `0a3bb32634cf491b8ec707b65ce506f0`
- Source item ID: `c83a8b7c1fdc4dcbbeb6ac8e87863bd1`
- Web map ID: `82e2409105e34e1e989241172d0e2154`
- Master table: <https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0>

The master table is the useful part for Civic Commons discovery. It contains catalogue records such as indicator IDs, geography/date identifiers, field IDs and service URLs. The service URLs can then be followed to the public ArcGIS layers holding the actual values.

## Run the reconnaissance

From the repository root:

```sh
npm run inspect:ealing-data
```

The command deliberately does **not** change the live Civic Commons site or ingest data into the application. It writes a discovery snapshot to the ignored directory `tmp/ealing-data/`:

- `master-table.raw.json` — ArcGIS metadata plus every raw master-table row fetched
- `inventory.json` — a normalised catalogue inventory
- `inventory.md` — a human-readable summary of themes, geographies, indicators and underlying service URLs

The script reads the ArcGIS layer metadata first, uses the layer's advertised record limit, and paginates until the entire catalogue has been fetched. It also resolves common InstantAtlas field-name variants rather than assuming one exact schema.

To write somewhere else:

```sh
npm run inspect:ealing-data -- --out-dir /tmp/ealing-data
```

To test against a replacement or migrated master table:

```sh
npm run inspect:ealing-data -- --master-table 'https://example.invalid/FeatureServer/0'
```

or set `EALING_DATA_MASTER_TABLE_URL`.

## Discovery phase questions

The first inventory is intended to answer these before any production integration is designed:

1. How many indicators and themes are available?
2. Which geographies are represented, especially ward/MSOA/LSOA or other neighbourhood-scale data?
3. Which indicators have useful time series?
4. How many distinct ArcGIS services sit behind the catalogue?
5. Which indicators are most relevant to Southall and Civic Commons reporting: housing, deprivation, health, environment, population, crime and local economy?
6. Are service URLs stable enough to support a read-only Civic Commons evidence adapter without scraping Ealing's presentation pages?

## Guardrails for the next phase

This discovery tool treats Ealing's own public catalogue as the source of truth and keeps provenance alongside the results. A future production adapter should additionally:

- cache upstream responses and avoid unnecessary requests;
- retain source, date, geography and unit metadata with every value;
- distinguish raw observations from Civic Commons interpretation;
- fail visibly when Ealing changes a service or field rather than silently serving stale data;
- prefer the underlying public ArcGIS services to scraping rendered Data Explorer pages;
- add scheduled checks only after we understand catalogue size, change frequency and upstream behaviour.

No automated ingestion or publication should be enabled until the reconnaissance output has been reviewed.
