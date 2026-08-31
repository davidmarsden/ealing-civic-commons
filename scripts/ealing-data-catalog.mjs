import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_MASTER_TABLE =
  "https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0";

const APP_ID = "0a3bb32634cf491b8ec707b65ce506f0";
const SOURCE_ITEM_ID = "c83a8b7c1fdc4dcbbeb6ac8e87863bd1";
const WEBMAP_ID = "82e2409105e34e1e989241172d0e2154";

function parseArgs(argv) {
  const args = { outDir: "tmp/ealing-data", masterTable: process.env.EALING_DATA_MASTER_TABLE_URL || DEFAULT_MASTER_TABLE };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out-dir") {
      args.outDir = argv[++i];
    } else if (argv[i] === "--master-table") {
      args.masterTable = argv[++i];
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }

  if (!args.outDir) throw new Error("--out-dir requires a value");
  if (!args.masterTable) throw new Error("--master-table requires a value");
  return args;
}

function usage() {
  console.log(`Ealing Data catalogue reconnaissance\n\nUsage:\n  npm run inspect:ealing-data\n  npm run inspect:ealing-data -- --out-dir tmp/ealing-data\n  npm run inspect:ealing-data -- --master-table https://.../FeatureServer/0\n\nEnvironment:\n  EALING_DATA_MASTER_TABLE_URL  Override the discovered Ealing master table URL.`);
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Ealing-Civic-Commons/0.1 (+https://commons.southallstories.uk/)"
    }
  });

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload?.error) {
    const details = payload.error.details?.filter(Boolean).join("; ");
    throw new Error(`${label} returned ArcGIS error ${payload.error.code}: ${payload.error.message}${details ? ` (${details})` : ""}`);
  }
  return payload;
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makeFieldLookup(fieldNames) {
  return new Map(fieldNames.map((name) => [normalizeKey(name), name]));
}

function findField(lookup, candidates) {
  for (const candidate of candidates) {
    const actual = lookup.get(normalizeKey(candidate));
    if (actual) return actual;
  }
  return null;
}

function valueFor(row, field) {
  if (!field) return null;
  const value = row[field];
  return value === undefined || value === null || value === "" ? null : value;
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== "").map(String))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function makeResolvedFields(fieldNames) {
  const lookup = makeFieldLookup(fieldNames);
  return {
    objectId: findField(lookup, ["OBJECTID", "FID"]),
    themeId: findField(lookup, ["Theme_ID", "ThemeID"]),
    themeName: findField(lookup, ["Theme", "Theme_Name", "ThemeName"]),
    indicatorId: findField(lookup, ["Indicator_ID", "IndicatorID"]),
    indicatorName: findField(lookup, ["Indicator", "Indicator_Name", "IndicatorName"]),
    geographyId: findField(lookup, ["Geo_ID", "GeoID", "Geography_ID", "GeographyID"]),
    geographyName: findField(lookup, ["Geo", "Geo_Name", "GeoName", "Geography", "Geography_Name", "GeographyName"]),
    dateId: findField(lookup, ["Date_ID", "DateID", "Date"]),
    serviceUrl: findField(lookup, ["Service_Url", "Service_URL", "ServiceUrl", "Service"]),
    fieldId: findField(lookup, ["Field_ID", "FieldID", "Field"]),
    source: findField(lookup, ["Source", "Data_Source", "DataSource"]),
    unit: findField(lookup, ["Unit", "Units"])
  };
}

async function fetchAllRows(masterTable, metadata) {
  const pageSize = Math.min(Number(metadata.maxRecordCount) || 2000, 2000);
  const objectIdField = metadata.objectIdField || metadata.fields?.find((field) => field.type === "esriFieldTypeOID")?.name || "OBJECTID";
  const rows = [];
  let offset = 0;

  while (true) {
    const query = new URL(`${masterTable.replace(/\/$/, "")}/query`);
    query.searchParams.set("where", "1=1");
    query.searchParams.set("outFields", "*");
    query.searchParams.set("returnGeometry", "false");
    query.searchParams.set("resultOffset", String(offset));
    query.searchParams.set("resultRecordCount", String(pageSize));
    query.searchParams.set("orderByFields", `${objectIdField} ASC`);
    query.searchParams.set("f", "json");

    const page = await fetchJson(query, `Master table page at offset ${offset}`);
    const features = Array.isArray(page.features) ? page.features : [];
    rows.push(...features.map((feature) => feature.attributes || {}));

    process.stdout.write(`Fetched ${rows.length} catalogue rows\r`);

    if (features.length === 0 || (!page.exceededTransferLimit && features.length < pageSize)) break;
    offset += features.length;
  }

  process.stdout.write("\n");
  return rows;
}

function buildInventory(rows, metadata, masterTable) {
  const fieldNames = metadata.fields?.map((field) => field.name) || Object.keys(rows[0] || {});
  const fields = makeResolvedFields(fieldNames);
  const groups = new Map();

  for (const row of rows) {
    const indicatorId = valueFor(row, fields.indicatorId);
    const indicatorName = valueFor(row, fields.indicatorName);
    const key = String(indicatorId || indicatorName || "(unknown indicator)");

    if (!groups.has(key)) {
      groups.set(key, {
        id: indicatorId,
        name: indicatorName,
        rowCount: 0,
        themes: [],
        geographies: [],
        dates: [],
        sources: [],
        units: [],
        services: new Map()
      });
    }

    const group = groups.get(key);
    group.rowCount += 1;
    group.themes.push(valueFor(row, fields.themeName) || valueFor(row, fields.themeId));
    group.geographies.push(valueFor(row, fields.geographyName) || valueFor(row, fields.geographyId));
    group.dates.push(valueFor(row, fields.dateId));
    group.sources.push(valueFor(row, fields.source));
    group.units.push(valueFor(row, fields.unit));

    const serviceUrl = valueFor(row, fields.serviceUrl);
    const fieldId = valueFor(row, fields.fieldId);
    if (serviceUrl) {
      if (!group.services.has(String(serviceUrl))) group.services.set(String(serviceUrl), new Set());
      if (fieldId) group.services.get(String(serviceUrl)).add(String(fieldId));
    }
  }

  const indicators = [...groups.values()].map((group) => ({
    id: group.id,
    name: group.name,
    rowCount: group.rowCount,
    themes: sortedUnique(group.themes),
    geographies: sortedUnique(group.geographies),
    dates: sortedUnique(group.dates),
    sources: sortedUnique(group.sources),
    units: sortedUnique(group.units),
    services: [...group.services.entries()].map(([url, fieldIds]) => ({ url, fieldIds: [...fieldIds].sort() }))
  })).sort((a, b) => String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""), undefined, { numeric: true, sensitivity: "base" }));

  const serviceUrls = sortedUnique(rows.map((row) => valueFor(row, fields.serviceUrl)));
  const themeValues = sortedUnique(rows.map((row) => valueFor(row, fields.themeName) || valueFor(row, fields.themeId)));
  const geographyValues = sortedUnique(rows.map((row) => valueFor(row, fields.geographyName) || valueFor(row, fields.geographyId)));
  const dateValues = sortedUnique(rows.map((row) => valueFor(row, fields.dateId)));

  return {
    generatedAt: new Date().toISOString(),
    provenance: {
      ealingDataExplorer: "https://data.ealing.gov.uk/data-catalog-explorer/",
      appId: APP_ID,
      sourceItemId: SOURCE_ITEM_ID,
      webmapId: WEBMAP_ID,
      masterTable
    },
    summary: {
      catalogueRows: rows.length,
      indicators: indicators.length,
      themes: themeValues.length,
      geographies: geographyValues.length,
      dates: dateValues.length,
      services: serviceUrls.length
    },
    schema: {
      objectIdField: metadata.objectIdField || fields.objectId,
      maxRecordCount: metadata.maxRecordCount || null,
      fields: metadata.fields || fieldNames,
      resolvedFields: fields
    },
    themes: themeValues,
    geographies: geographyValues,
    dates: dateValues,
    serviceUrls,
    indicators
  };
}

function markdownTableCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function toMarkdown(inventory) {
  const { summary } = inventory;
  const lines = [
    "# Ealing Data catalogue reconnaissance",
    "",
    `Generated: ${inventory.generatedAt}`,
    "",
    `Master table: ${inventory.provenance.masterTable}`,
    "",
    "## Summary",
    "",
    `- Catalogue rows: **${summary.catalogueRows}**`,
    `- Unique indicators: **${summary.indicators}**`,
    `- Themes: **${summary.themes}**`,
    `- Geographies: **${summary.geographies}**`,
    `- Dates: **${summary.dates}**`,
    `- Underlying ArcGIS services: **${summary.services}**`,
    "",
    "## Resolved schema",
    "",
    "```json",
    JSON.stringify(inventory.schema.resolvedFields, null, 2),
    "```",
    "",
    "## Themes",
    "",
    ...(inventory.themes.length ? inventory.themes.map((item) => `- ${item}`) : ["_No theme field was resolved._"]),
    "",
    "## Geographies",
    "",
    ...(inventory.geographies.length ? inventory.geographies.map((item) => `- ${item}`) : ["_No geography field was resolved._"]),
    "",
    "## Indicators",
    "",
    "| ID | Indicator | Themes | Geographies | Dates | Services | Rows |",
    "| --- | --- | --- | --- | --- | ---: | ---: |"
  ];

  for (const indicator of inventory.indicators) {
    lines.push(`| ${markdownTableCell(indicator.id)} | ${markdownTableCell(indicator.name)} | ${markdownTableCell(indicator.themes.join(", "))} | ${markdownTableCell(indicator.geographies.join(", "))} | ${markdownTableCell(indicator.dates.join(", "))} | ${indicator.services.length} | ${indicator.rowCount} |`);
  }

  lines.push("", "## Underlying services", "");
  if (inventory.serviceUrls.length) {
    inventory.serviceUrls.forEach((url) => lines.push(`- ${url}`));
  } else {
    lines.push("_No service URL field was resolved._");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const masterTable = args.masterTable.replace(/\/$/, "");
  console.log(`Inspecting Ealing Data catalogue:\n${masterTable}\n`);

  const metadataUrl = new URL(masterTable);
  metadataUrl.searchParams.set("f", "json");
  const metadata = await fetchJson(metadataUrl, "Master table metadata");
  const rows = await fetchAllRows(masterTable, metadata);

  if (!rows.length) throw new Error("Ealing master table returned no catalogue rows");

  const inventory = buildInventory(rows, metadata, masterTable);
  const outDir = path.resolve(args.outDir);
  await mkdir(outDir, { recursive: true });

  await writeFile(path.join(outDir, "master-table.raw.json"), `${JSON.stringify({ metadata, rows }, null, 2)}\n`);
  await writeFile(path.join(outDir, "inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(path.join(outDir, "inventory.md"), toMarkdown(inventory));

  console.log(`\nEaling Data catalogue inventory complete.`);
  console.log(`Rows:       ${inventory.summary.catalogueRows}`);
  console.log(`Indicators: ${inventory.summary.indicators}`);
  console.log(`Themes:     ${inventory.summary.themes}`);
  console.log(`Geographies:${inventory.summary.geographies}`);
  console.log(`Services:   ${inventory.summary.services}`);
  console.log(`\nWrote:\n  ${path.join(outDir, "master-table.raw.json")}\n  ${path.join(outDir, "inventory.json")}\n  ${path.join(outDir, "inventory.md")}`);
}

main().catch((error) => {
  console.error(`\nEaling Data reconnaissance failed: ${error.message}`);
  process.exitCode = 1;
});
