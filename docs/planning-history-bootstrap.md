# Planning history bootstrap

**Status:** implementation ready for reviewed backfill

Ealing Civic Commons keeps Ealing Council PAM as the canonical source for current planning applications, but the Commons planning archive is designed to retain records after they leave the weekly list.

## Planning-Records.uk bootstrap

`npm run bootstrap:planning-history` reads the public Ealing index at `https://planning-records.uk/ealing/` and merges missing applications into `public/data/planning-archive.json`.

The bootstrap is deliberately conservative:

- existing Commons/PAM records are never overwritten by Planning-Records data;
- existing records gain only a provenance reference when Planning-Records also contains them;
- missing records are added as `historical-backfill` records;
- backfilled records do not invent an Ealing PAM deep-link when the canonical `keyVal` is unknown;
- the importer refuses to update the archive if fewer than 1,000 source rows are parsed, protecting against upstream markup changes or partial responses;
- rerunning the importer is idempotent once the same Planning-Records dataset has been applied.

Planning-Records currently provides Ealing records from 1 January 2024 through 31 May 2026. That makes it a bootstrap/comparator source rather than a freshness source. Weekly PAM ingestion remains responsible for current records and later lifecycle observations.

## Planning Atlas links

Every Commons planning object derives a stable external analysis URL from the application reference:

`https://www.planningatlas.co.uk/atlas/ealing/applications/{REFERENCE}`

The link is presented as **View in Planning Atlas** alongside the authoritative PAM link when one is known. Planning Atlas remains a secondary analysis/reference service; the Commons does not treat its status, interpretation or subscription-only analysis as authoritative.

## Provenance

Historical records imported from Planning-Records carry:

- `archive_origin: "historical-backfill"`;
- `reference_sources` identifying Planning-Records and the import timestamp;
- a history observation representing the imported public-record state;
- the normal Commons town/category/place-link derivations where deterministically available.

If a backfilled application later appears in a PAM weekly ingest, the normal publisher merges the PAM observation into the same application identity. The authoritative current record therefore wins without losing the historical provenance.

## Running the bootstrap

```bash
npm run bootstrap:planning-history
```

For review or reproducible testing, the importer also accepts:

```bash
node scripts/bootstrap-planning-records.mjs \
  --input=/path/to/saved-planning-records.html \
  --archive=/path/to/planning-archive.json \
  --source=https://planning-records.uk/ealing/
```

The resulting archive diff should be reviewed before merge because the first bootstrap can add thousands of durable civic records.
