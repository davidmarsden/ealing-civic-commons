const MASTER_TABLE = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0';
const EXPLORER = 'https://data.ealing.gov.uk/data-catalog-explorer/';
const USER_AGENT = 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)';

const PROBES = [
  {
    id: 'imd',
    label: 'Deprivation / IMD',
    terms: ['deprivation', 'multiple deprivation', 'IMD'],
    prefer: [/index of multiple deprivation/i, /\bimd\b/i],
    wantedDates: [/2015/, /2019/, /2025/],
    maxIndicators: 4,
    maxInstances: 4
  },
  {
    id: 'air-quality',
    label: 'Air quality',
    terms: ['air quality', 'benzene', 'nitrogen dioxide', 'particulate'],
    prefer: [/benzene/i, /nitrogen dioxide/i, /particulate/i, /air quality/i],
    wantedDates: [/2023/],
    maxIndicators: 5,
    maxInstances: 2
  },
  {
    id: 'overcrowding',
    label: 'Housing / overcrowding',
    terms: ['overcrowd', 'over-occup'],
    prefer: [/overcrowd/i, /occupancy rating/i],
    wantedDates: [/2021/],
    maxIndicators: 4,
    maxInstances: 2
  },
  {
    id: 'child-poverty',
    label: 'Child poverty / low income',
    terms: ['child low income', 'children low income', 'children in low income', 'relative low income'],
    prefer: [/child.*low income/i, /children.*low income/i, /relative low income/i],
    wantedDates: [/2024/, /2025/, /2024\/25/],
    maxIndicators: 4,
    maxInstances: 3
  },
  {
    id: 'homelessness',
    label: 'Homelessness',
    terms: ['homeless'],
    prefer: [/core homelessness rate/i, /homelessness rate/i, /homeless/i],
    wantedDates: [/2020/, /2021/, /2022/, /2023/],
    maxIndicators: 4,
    maxInstances: 4
  }
];

const GEO_WANTED = /ward|town profile|lsoa/i;
const requests = new Map();

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': USER_AGENT }
    });
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error) throw new Error(`${label}: ArcGIS ${payload.error.code} ${payload.error.message}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function arcgisQuery(layer, { where = '1=1', outFields = '*', orderByFields = '', returnGeometry = false } = {}) {
  const key = JSON.stringify([layer, where, outFields, orderByFields, returnGeometry]);
  if (requests.has(key)) return requests.get(key);
  const promise = (async () => {
    const url = new URL(`${layer.replace(/\/$/, '')}/query`);
    url.searchParams.set('where', where);
    url.searchParams.set('outFields', outFields);
    url.searchParams.set('returnGeometry', returnGeometry ? 'true' : 'false');
    if (orderByFields) url.searchParams.set('orderByFields', orderByFields);
    url.searchParams.set('f', 'json');
    const payload = await fetchJson(url, `ArcGIS query ${layer}`);
    return Array.isArray(payload.features) ? payload.features.map(feature => ({ ...feature.attributes, __geometry: feature.geometry || null })) : [];
  })();
  requests.set(key, promise);
  return promise;
}

function likeWhere(terms) {
  const conditions = [];
  for (const term of terms) {
    const escaped = String(term).replaceAll("'", "''");
    const title = escaped.replace(/\b\w/g, ch => ch.toUpperCase());
    conditions.push(`Name LIKE '%${escaped}%'`);
    if (title !== escaped) conditions.push(`Name LIKE '%${title}%'`);
  }
  return `Item_Type='Indicator' AND (${[...new Set(conditions)].join(' OR ')})`;
}

function textValues(row) {
  return Object.values(row || {}).filter(value => typeof value === 'string' && value.trim());
}

function containsSouthall(row) {
  return textValues(row).some(value => value.toLowerCase().includes('southall'));
}

function identifierValues(row) {
  const values = new Set();
  for (const [key, value] of Object.entries(row || {})) {
    if (value === null || value === undefined || value === '') continue;
    if (/code|\bcd\b|id$|name|ward|lsoa|msoa|town/i.test(key)) values.add(String(value).trim());
  }
  return values;
}

function placeLabel(row) {
  const preferred = ['TownName', 'Town_Name', 'WardName', 'Ward_Name', 'LSOA21NM', 'LSOAName', 'Name', 'NAME'];
  for (const key of preferred) if (row?.[key]) return String(row[key]);
  const southall = textValues(row).find(value => value.toLowerCase().includes('southall'));
  return southall || 'Southall area';
}

function indicatorScore(row, spec, geoById) {
  const name = String(row.Name || '');
  let score = spec.prefer.reduce((total, rx, index) => total + (rx.test(name) ? 40 - index * 4 : 0), 0);
  const geoName = geoById.get(String(row.Geo_ID))?.name || '';
  if (/town profile/i.test(geoName)) score += 18;
  if (/ward/i.test(geoName)) score += 16;
  if (/lsoa/i.test(geoName)) score += 14;
  if (/rate|score|rank|decile|percentage|percent|proportion/i.test(name)) score += 3;
  return score;
}

function chooseInstances(rows, spec) {
  const sorted = [...rows].sort((a, b) => String(b.Name || b.Date_ID || '').localeCompare(String(a.Name || a.Date_ID || ''), undefined, { numeric: true }));
  const wanted = sorted.filter(row => spec.wantedDates.some(rx => rx.test(`${row.Name || ''} ${row.Date_ID || ''}`)));
  return (wanted.length ? wanted : sorted).slice(0, spec.maxInstances);
}

async function loadGeographies() {
  const geoRows = await arcgisQuery(MASTER_TABLE, {
    where: "Item_Type='Geo'",
    outFields: 'ID,Name,Service_Url,Item_Order',
    orderByFields: 'Item_Order ASC'
  });
  const all = new Map();
  for (const row of geoRows) {
    if (!row.ID) continue;
    all.set(String(row.ID), { id: String(row.ID), name: String(row.Name || row.ID), serviceUrl: row.Service_Url || null });
  }

  const southallIds = new Map();
  const geographyDiagnostics = [];
  for (const geo of [...all.values()].filter(item => GEO_WANTED.test(item.name) && item.serviceUrl)) {
    try {
      const rows = await arcgisQuery(geo.serviceUrl, { outFields: '*' });
      const direct = rows.filter(containsSouthall);
      const ids = new Set();
      for (const row of direct) for (const value of identifierValues(row)) ids.add(value);
      southallIds.set(geo.id, ids);
      geographyDiagnostics.push({ id: geo.id, name: geo.name, matchedFeatures: direct.length, identifiers: ids.size });
    } catch (error) {
      geographyDiagnostics.push({ id: geo.id, name: geo.name, matchedFeatures: 0, identifiers: 0, error: String(error.message || error) });
    }
  }
  return { all, southallIds, geographyDiagnostics };
}

async function observationsForInstance(instance, geoById, southallIds) {
  if (!instance.Service_Url || !instance.Field_ID) return { observations: [], note: 'Instance has no data service or value field.' };
  const geoId = String(instance.Geo_ID || '');
  const geo = geoById.get(geoId);
  const ids = southallIds.get(geoId) || new Set();
  const rows = await arcgisQuery(instance.Service_Url, { outFields: '*' });
  const matches = rows.filter(row => {
    if (containsSouthall(row)) return true;
    if (!ids.size) return false;
    return Object.values(row || {}).some(value => value !== null && value !== undefined && ids.has(String(value).trim()));
  });

  const observations = matches
    .filter(row => row[instance.Field_ID] !== undefined && row[instance.Field_ID] !== null && row[instance.Field_ID] !== '')
    .map(row => ({
      place: placeLabel(row),
      value: row[instance.Field_ID],
      fieldId: instance.Field_ID
    }))
    .slice(0, 30);

  return {
    geography: geo ? { id: geo.id, name: geo.name } : { id: geoId, name: geoId || 'Unknown geography' },
    observations,
    matchedRows: matches.length,
    serviceUrl: instance.Service_Url,
    fieldId: instance.Field_ID
  };
}

async function runProbe(spec, geoById, southallIds) {
  const candidates = await arcgisQuery(MASTER_TABLE, {
    where: likeWhere(spec.terms),
    outFields: 'ID,Name,Short_Name,Geo_ID,Theme_ID,Data_Type'
  });

  const ranked = candidates
    .filter(row => row.ID && GEO_WANTED.test(geoById.get(String(row.Geo_ID))?.name || ''))
    .map(row => ({ ...row, __score: indicatorScore(row, spec, geoById) }))
    .sort((a, b) => b.__score - a.__score || String(a.Name).localeCompare(String(b.Name)))
    .slice(0, spec.maxIndicators);

  if (!ranked.length) return { id: spec.id, label: spec.label, candidates: candidates.length, indicators: [], warning: 'No matching neighbourhood-scale indicators found.' };

  const ids = ranked.map(row => String(row.ID));
  const instances = await arcgisQuery(MASTER_TABLE, {
    where: `Item_Type='Instance' AND Indicator_ID IN (${ids.map(sqlLiteral).join(',')})`,
    outFields: 'Indicator_ID,Geo_ID,Date_ID,Name,Service_Url,Field_ID,Source,Unit'
  });

  const indicators = [];
  for (const indicator of ranked) {
    const indicatorInstances = chooseInstances(instances.filter(row => String(row.Indicator_ID) === String(indicator.ID)), spec);
    const resolved = [];
    for (const instance of indicatorInstances) {
      try {
        resolved.push({
          date: instance.Name || instance.Date_ID || null,
          dateId: instance.Date_ID || null,
          source: instance.Source || null,
          unit: instance.Unit || null,
          ...(await observationsForInstance(instance, geoById, southallIds))
        });
      } catch (error) {
        resolved.push({ date: instance.Name || instance.Date_ID || null, error: String(error.message || error), observations: [] });
      }
    }
    indicators.push({
      id: String(indicator.ID),
      name: indicator.Name || indicator.Short_Name || String(indicator.ID),
      shortName: indicator.Short_Name || null,
      geography: geoById.get(String(indicator.Geo_ID)) || { id: String(indicator.Geo_ID || ''), name: String(indicator.Geo_ID || 'Unknown') },
      dataType: indicator.Data_Type || null,
      score: indicator.__score,
      instances: resolved
    });
  }

  return { id: spec.id, label: spec.label, candidates: candidates.length, indicators };
}

async function buildProbe() {
  const started = Date.now();
  const { all: geoById, southallIds, geographyDiagnostics } = await loadGeographies();
  const groups = [];
  for (const spec of PROBES) {
    try {
      groups.push(await runProbe(spec, geoById, southallIds));
    } catch (error) {
      groups.push({ id: spec.id, label: spec.label, candidates: 0, indicators: [], error: String(error.message || error) });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    status: groups.some(group => group.indicators?.some(indicator => indicator.instances?.some(instance => instance.observations?.length))) ? 'ok' : 'empty',
    place: 'Southall',
    scope: 'Exploratory evidence probe — not yet production ingestion',
    provenance: { dataExplorer: EXPLORER, masterTable: MASTER_TABLE },
    geographyDiagnostics,
    groups
  };
}

export default async () => {
  try {
    const payload = await buildProbe();
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=900, stale-while-revalidate=3600',
        'access-control-allow-origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', error: String(error?.message || error), generatedAt: new Date().toISOString() }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};
