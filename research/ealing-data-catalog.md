# Ealing Data catalogue reconnaissance

Ealing Council's public Data Explorer is an InstantAtlas/ArcGIS application. The visible website does not advertise an API, but its public application configuration exposes a master catalogue table which points to the underlying ArcGIS services used by individual indicators.

## Discovered public configuration

- Ealing Data Explorer: <https://data.ealing.gov.uk/data-catalog-explorer/>
- Data Explorer app ID: `0a3bb32634cf491b8ec707b65ce506f0`
- Source item ID: `c83a8b7c1fdc4dcbbeb6ac8e87863bd1`
- Web map ID: `82e2409105e34e1e989241172d0e2154`
- Master table: <https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0>

The master table is the useful part for Civic Commons discovery. It contains catalogue records such as indicator IDs, geography/date identifiers, field IDs and service URLs. The service URLs can then be followed to the public ArcGIS layers holding the actual values.

## First successful extraction — 31 August 2026

The reconnaissance workflow successfully fetched and classified the complete public master table:

- **427,255 catalogue rows**
- **16,897 unique indicators**
- **591 themes**, including 9 top-level themes
- **365,391 indicator instances**
- **1,237 underlying ArcGIS data services**
- **7 supported geographies**

Top-level themes are Population; Housing; Health; Children and Education; Economy, Jobs and Benefits; Crime; Deprivation; Environment; and Deprecated.

The seven geographies are:

- LSOA 2011
- Local authority
- Ward
- Region
- Country
- **Town Profile**
- **LSOA 2021**

Neighbourhood coverage is substantial: the catalogue currently exposes about 5,169 indicators at ward level, 5,012 at Town Profile level and 2,089 at LSOA 2021 level. These counts include related measures such as rates, counts, denominators and confidence limits, so they are a discovery measure rather than a count of distinct civic questions.

Early examples particularly relevant to Civic Commons and Southall reporting include:

- IMD score/rank/decile for 2015, 2019 and **2025**, down to LSOA 2021, ward and Town Profile;
- air quality plus benzene, nitrogen dioxide, particulates and sulphur dioxide components for **2023**, down to LSOA 2021, ward and Town Profile;
- core homelessness rate (% of households), 2020–2023, down to LSOA 2021, ward and Town Profile;
- household overcrowding indicators, including a 2021 bedrooms measure, down to LSOA 2021, ward and Town Profile;
- child low-income measures, including 2024/25 data, down to LSOA 2021, ward and Town Profile;
- private-rental and owner-occupation affordability measures, down to LSOA 2021, ward and Town Profile;
- monthly and 12-month rolling crime rates with data into 2026, down to LSOA 2021, ward and Town Profile;
- Census 2021 tenure measures, including private renting, down to LSOA 2021, ward and Town Profile;
- noise pollution and other IMD underlying indicators at neighbourhood scale.

This confirms that the catalogue is not merely a borough-level statistical portal. It contains a sizeable neighbourhood evidence layer suitable for later Civic Commons integration.

## Run the reconnaissance

From the repository root:

```sh
npm run inspect:ealing-data
```

The command deliberately does **not** change the live Civic Commons site or ingest data into the application. It writes a discovery snapshot to the ignored directory `tmp/ealing-data/`:

- `master-table.raw.json` — ArcGIS metadata plus every raw master-table row fetched
- `inventory.json` — a normalised catalogue inventory with human-readable theme and geography labels
- `inventory.md` — a human-readable summary of themes, geographies, indicators and underlying service URLs

The script reads the ArcGIS layer metadata first, uses the layer's advertised record limit, and paginates until the entire catalogue has been fetched. It interprets the master table's `Geo`, `Theme`, `Indicator` and `Instance` rows to reconstruct the catalogue hierarchy and indicator labels.

A manual GitHub Actions workflow can also generate the inventory without using Netlify build credits. The resulting `ealing-data-catalogue` artifact is retained for 14 days.

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
2. Which geographies are represented, especially ward/Town Profile/LSOA data?
3. Which indicators have useful time series?
4. How many distinct ArcGIS services sit behind the catalogue?
5. Which indicators are most relevant to Southall and Civic Commons reporting: housing, deprivation, health, environment, population, crime and local economy?
6. Are service URLs stable enough to support a read-only Civic Commons evidence adapter without scraping Ealing's presentation pages?
7. How should Southall be represented across Town Profile, ward and LSOA boundaries?

## Guardrails for the next phase

This discovery tool treats Ealing's own public catalogue as the source of truth and keeps provenance alongside the results. A future production adapter should additionally:

- cache upstream responses and avoid unnecessary requests;
- retain source, date, geography and unit metadata with every value;
- distinguish raw observations from Civic Commons interpretation;
- fail visibly when Ealing changes a service or field rather than silently serving stale data;
- prefer the underlying public ArcGIS services to scraping rendered Data Explorer pages;
- add scheduled checks only after we understand catalogue size, change frequency and upstream behaviour.

No automated ingestion or publication should be enabled until the reconnaissance output has been reviewed.
