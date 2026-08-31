import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_MASTER_TABLE =
  "https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0";

const APP_ID = "0a3bb32634cf491b8ec707b65ce506f0";
const SOURCE_ITEM_ID = "c83a8b7c1fdc4dcbbeb6ac8e87863bd1";
const WEBMAP_ID = "82e2409105e34e1e989241172d0e2154";

function parseArgs(argv) {
  const args = {
    outDir: "tmp/ealing-data",
    masterTable: process.env.EALING_DATA_MASTER_TABLE_URL || DEFAULT_MASTER_TABLE
  };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out-dir") args.outDir = argv[++i];
    else if (argv[i] === "--master-table") args.masterTable = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
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

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== "").map(String))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

function validateMasterTableMetadata(metadata) {
  if (metadata.advancedQueryCapabilities?.supportsPagination === false) {
    throw new Error(
      "Master table does not support resultOffset pagination; refusing to fetch because the server may repeat the first page indefinitely"
    );
  }

  const fieldNames = new Set((metadata.fields || []).map((field) => field.name));
  const requiredFields = ["Item_Type", "ID", "Indicator_ID"];
  const missingFields = requiredFields.filter((field) => !fieldNames.has(field));
  if (missingFields.length) {
    throw new Error(
      `Master table schema is incompatible with this InstantAtlas catalogue parser; missing required field(s): ${missingFields.join(", ")}`
    );
  }

  const objectIdField = metadata.objectIdField || metadata.fields?.find((field) => field.type === "esriFieldTypeOID")?.name;
  if (!objectIdField) {
    throw new Error("Master table metadata does not expose an object ID field required for stable pagination");
  }

  return objectIdField;
}

async function fetchAllRows(masterTable, metadata) {
  const pageSize = Math.min(Number(metadata.maxRecordCount) || 2000, 2000);
  const objectIdField = validateMasterTableMetadata(metadata);
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

function themePath(themeId, themeById) {
  const path = [];
  const seen = new Set();
  let currentId = themeId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const theme = themeById.get(String(currentId));
    if (!theme) {
      path.unshift(String(currentId));
      break;
    }
    path.unshift(theme.name || theme.id);
    currentId = theme.parentId;
  }

  return path;
}

function buildInventory(rows, metadata, masterTable) {
  const byType = new Map();
  for (const row of rows) {
    const type = String(row.Item_Type || "Unknown");
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(row);
  }

  const geoRows = byType.get("Geo") || [];
  const themeRows = byType.get("Theme") || [];
  const indicatorRows = byType.get("Indicator") || [];
  const instanceRows = byType.get("Instance") || [];

  if (!indicatorRows.length) {
    throw new Error("Master table contains no Item_Type=Indicator rows; refusing to generate a misleading empty inventory");
  }

  if (!instanceRows.length) {
    throw new Error("Master table contains no Item_Type=Instance rows; indicator observations cannot be reconstructed");
  }

  const geoById = new Map();
  for (const row of geoRows) {
    const id = String(row.ID);
    if (!geoById.has(id)) {
      geoById.set(id, {
        id,
        name: row.Name || id,
        order: row.Item_Order ?? null,
        serviceUrl: row.Service_Url || null
      });
    }
  }

  const themeById = new Map();
  for (const row of themeRows) {
    const id = String(row.ID);
    if (!themeById.has(id)) {
      themeById.set(id, {
        id,
        name: row.Name || id,
        parentId: row.Theme_ID ? String(row.Theme_ID) : null,
        order: row.Item_Order ?? null
      });
    }
  }

  const indicators = new Map();
  function ensureIndicator(id) {
    if (id === null || id === undefined || id === "") {
      throw new Error("Encountered an indicator record without an indicator ID");
    }

    const key = String(id);
    if (!indicators.has(key)) {
      indicators.set(key, {
        id: key,
        names: [],
        shortNames: [],
        themeIds: [],
        geographyIds: [],
        dataTypes: [],
        dateIds: [],
        dateLabels: [],
        instanceCount: 0,
        services: new Map()
      });
    }
    return indicators.get(key);
  }

  for (const row of indicatorRows) {
    if (!row.ID) {
      throw new Error("Encountered an Item_Type=Indicator row without ID; catalogue schema/data is incompatible");
    }
    const indicator = ensureIndicator(row.ID);
    indicator.names.push(row.Name);
    indicator.shortNames.push(row.Short_Name);
    indicator.themeIds.push(row.Theme_ID);
    indicator.geographyIds.push(row.Geo_ID);
    indicator.dataTypes.push(row.Data_Type);
  }

  const globalServices = new Set();
  for (const row of instanceRows) {
    if (!row.Indicator_ID) {
      throw new Error("Encountered an Item_Type=Instance row without Indicator_ID; catalogue schema/data is incompatible");
    }
    const indicator = ensureIndicator(row.Indicator_ID);
    indicator.instanceCount += 1;
    indicator.geographyIds.push(row.Geo_ID);
    indicator.dateIds.push(row.Date_ID);
    indicator.dateLabels.push(row.Name);

    if (row.Service_Url) {
      const serviceUrl = String(row.Service_Url);
      globalServices.add(serviceUrl);
      if (!indicator.services.has(serviceUrl)) indicator.services.set(serviceUrl, new Set());
      if (row.Field_ID) indicator.services.get(serviceUrl).add(String(row.Field_ID));
    }
  }

  const indicatorList = [...indicators.values()].map((indicator) => {
    const themeIds = sortedUnique(indicator.themeIds);
    const geographyIds = sortedUnique(indicator.geographyIds);
    const names = sortedUnique(indicator.names);
    const shortNames = sortedUnique(indicator.shortNames);

    return {
      id: indicator.id,
      name: names[0] || indicator.id,
      alternateNames: names.slice(1),
      shortName: shortNames[0] || null,
      dataTypes: sortedUnique(indicator.dataTypes),
      themes: themeIds.map((id) => ({
        id,
        name: themeById.get(id)?.name || id,
        path: themePath(id, themeById)
      })),
      geographies: geographyIds.map((id) => ({ id, name: geoById.get(id)?.name || id })),
      dates: sortedUnique(indicator.dateLabels),
      dateIds: sortedUnique(indicator.dateIds),
      instanceCount: indicator.instanceCount,
      services: [...indicator.services.entries()].map(([url, fieldIds]) => ({
        url,
        fieldIds: [...fieldIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      }))
    };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  const rootThemes = [...themeById.values()]
    .filter((theme) => !theme.parentId)
    .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999) || a.name.localeCompare(b.name));

  const geographies = [...geoById.values()]
    .sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999) || a.name.localeCompare(b.name));

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
      itemTypes: Object.fromEntries([...byType.entries()].map(([type, items]) => [type, items.length]).sort()),
      indicators: indicatorList.length,
      themes: themeById.size,
      rootThemes: rootThemes.length,
      geographies: geographies.length,
      dateLabels: sortedUnique(instanceRows.map((row) => row.Name)).length,
      services: globalServices.size
    },
    schema: {
      objectIdField: metadata.objectIdField || null,
      maxRecordCount: metadata.maxRecordCount || null,
      fields: metadata.fields || []
    },
    rootThemes,
    themes: [...themeById.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    geographies,
    serviceUrls: [...globalServices].sort(),
    indicators: indicatorList
  };
}

function cell(value) {
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
    `- Themes: **${summary.themes}** (${summary.rootThemes} top-level)`,
    `- Geographies: **${summary.geographies}**`,
    `- Distinct date labels: **${summary.dateLabels}**`,
    `- Underlying ArcGIS data services: **${summary.services}**`,
    `- Item types: ${Object.entries(summary.itemTypes).map(([key, value]) => `${key} ${value}`).join(", ")}`,
    "",
    "## Top-level themes",
    "",
    ...inventory.rootThemes.map((theme) => `- ${theme.name} (${theme.id})`),
    "",
    "## Geographies",
    "",
    ...inventory.geographies.map((geo) => `- ${geo.name} (${geo.id})`),
    "",
    "## Indicators",
    "",
    "| ID | Indicator | Theme | Geographies | Dates | Services | Instances |",
    "| --- | --- | --- | --- | ---: | ---: | ---: |"
  ];

  for (const indicator of inventory.indicators) {
    const themes = indicator.themes.map((theme) => theme.path.join(" › ")).join("; ");
    const geographies = indicator.geographies.map((geo) => geo.name).join(", ");
    lines.push(`| ${cell(indicator.id)} | ${cell(indicator.name)} | ${cell(themes)} | ${cell(geographies)} | ${indicator.dates.length} | ${indicator.services.length} | ${indicator.instanceCount} |`);
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

  console.log("\nEaling Data catalogue inventory complete.");
  console.log(`Rows:        ${inventory.summary.catalogueRows}`);
  console.log(`Indicators:  ${inventory.summary.indicators}`);
  console.log(`Themes:      ${inventory.summary.themes}`);
  console.log(`Geographies: ${inventory.summary.geographies}`);
  console.log(`Services:    ${inventory.summary.services}`);
  console.log(`\nWrote:\n  ${path.join(outDir, "master-table.raw.json")}\n  ${path.join(outDir, "inventory.json")}\n  ${path.join(outDir, "inventory.md")}`);
}

main().catch((error) => {
  console.error(`\nEaling Data reconnaissance failed: ${error.message}`);
  process.exitCode = 1;
});
