const MASTER_TABLE = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0';
const EXPLORER = 'https://data.ealing.gov.uk/data-catalog-explorer/';
const USER_AGENT = 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)';

const IMD_LSOA = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_IMD/FeatureServer/6';
const LOW_INCOME_WARD = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_LowIncFam_Ahc_Rel/FeatureServer/1';
const LOW_INCOME_TOWN = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_LowIncFam_Ahc_Rel/FeatureServer/4';

const GEOGRAPHIES = [
  { id: 'G7', name: 'Ward', serviceUrl: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/2' },
  { id: 'G109', name: 'Town Profile', serviceUrl: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/5' },
  { id: 'G113', name: 'LSOA 2021', serviceUrl: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/6' }
];

function instance(date, geography, serviceUrl, fieldId, options = {}) {
  return { date, geography, serviceUrl, fieldId, ...options };
}

const GROUPS = [
  {
    id: 'imd',
    label: 'Deprivation / IMD',
    note: 'Ealing publishes populated 2025 values for Southall on the LSOA 2021 layer. The 2015 and 2019 fields are null on that newer geography, so this probe does not manufacture a cross-boundary trend.',
    indicators: [
      {
        id: 'I3091',
        name: 'Index of Multiple Deprivation (IMD) Score',
        dataType: 'score',
        instances: [instance('2025', 'LSOA 2021', IMD_LSOA, 'ID3091D20250101000000', { mode: 'southall-lsoa' })]
      },
      {
        id: 'I3089',
        name: 'Index of Multiple Deprivation (IMD) Decile',
        dataType: 'decile',
        instances: [instance('2025', 'LSOA 2021', IMD_LSOA, 'ID3089D20250101000000', { mode: 'southall-lsoa', categorical: true })]
      }
    ]
  },
  {
    id: 'air-quality',
    label: 'Air quality',
    note: 'The Ward and Town Profile rows in Ealing’s service contain nulls for these fields. The published Southall LSOA 2021 values are shown directly instead.',
    indicators: [
      { id: 'I25375', name: 'Air quality indicator', instances: [instance('2023', 'LSOA 2021', IMD_LSOA, 'ID25375D20230101000000', { mode: 'southall-lsoa' })] },
      { id: 'I30920', name: 'Benzene (component of air quality indicator)', instances: [instance('2023', 'LSOA 2021', IMD_LSOA, 'ID30920D20230101000000', { mode: 'southall-lsoa' })] },
      { id: 'I30919', name: 'Nitrogen dioxide (component of air quality indicator)', instances: [instance('2023', 'LSOA 2021', IMD_LSOA, 'ID30919D20230101000000', { mode: 'southall-lsoa' })] },
      { id: 'I30922', name: 'Particulates (component of air quality indicator)', instances: [instance('2023', 'LSOA 2021', IMD_LSOA, 'ID30922D20230101000000', { mode: 'southall-lsoa' })] }
    ]
  },
  {
    id: 'overcrowding',
    label: 'Housing / overcrowding',
    note: 'The source field is labelled “Household overcrowding indicator (bedrooms)”. Values are presented in Ealing’s raw units rather than converted into a percentage without metadata confirming that conversion.',
    indicators: [
      { id: 'I44458', name: 'Household overcrowding indicator (bedrooms)', instances: [instance('2021', 'LSOA 2021', IMD_LSOA, 'ID44458D20210101000000', { mode: 'southall-lsoa' })] }
    ]
  },
  {
    id: 'child-poverty',
    label: 'Child poverty / low income',
    note: 'Unlike the IMD-derived indicators, Ealing publishes populated Ward and Town Profile rows here, so the probe shows those directly rather than deriving them from LSOAs.',
    indicators: [
      {
        id: 'I44674',
        name: 'After Housing Cost - Relative Low Income, age 0–15 rate',
        dataType: 'rate',
        instances: [
          instance('2024/25', 'Ward', LOW_INCOME_WARD, 'ID44674D2024', { mode: 'direct-southall', unit: '%' }),
          instance('2024/25', 'Town Profile', LOW_INCOME_TOWN, 'ID44674D2024', { mode: 'direct-southall', unit: '%' })
        ]
      },
      {
        id: 'I44704',
        name: 'After Housing Cost - Children in Relative Low Income Families, total',
        dataType: 'count',
        instances: [
          instance('2024/25', 'Ward', LOW_INCOME_WARD, 'ID44704D2024', { mode: 'direct-southall' }),
          instance('2024/25', 'Town Profile', LOW_INCOME_TOWN, 'ID44704D2024', { mode: 'direct-southall' })
        ]
      }
    ]
  },
  {
    id: 'homelessness',
    label: 'Homelessness',
    note: 'Ealing’s Ward and Town Profile rows are null for this indicator; the populated LSOA 2021 values are shown directly. The indicator title defines the value as a percentage of households.',
    indicators: [
      { id: 'I44455', name: 'Core homelessness rate (% of households)', dataType: 'rate', instances: [instance('2020–2023', 'LSOA 2021', IMD_LSOA, 'ID44455D20200101000000', { mode: 'southall-lsoa', unit: '%' })] }
    ]
  }
];

function textValues(row) {
  return Object.values(row || {}).filter(value => typeof value === 'string' && value.trim());
}

function containsSouthall(row) {
  return textValues(row).some(value => /southall/i.test(value));
}

function placeLabel(row, geography) {
  if (geography === 'LSOA 2021') {
    const name = row?.NAME || row?.LSOA2021Name || row?.LSOA21NM || 'LSOA';
    const code = row?.LSOA2021Code || row?.LSOA21CD || '';
    return code ? `${name} (${code})` : String(name);
  }
  return String(row?.NAME || row?.WardName || row?.TownName || textValues(row).find(value => /southall/i.test(value)) || 'Southall');
}

function numericSummary(observations) {
  const values = observations.map(item => Number(item.value)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return { count: values.length, min: values[0], median, max: values[values.length - 1] };
}

function categoricalSummary(observations) {
  const counts = new Map();
  for (const observation of observations) {
    const key = String(observation.value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true }));
}

async function fetchJson(url, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': USER_AGENT } });
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
    const payload = await response.json();
    if (payload?.error) throw new Error(`${label}: ArcGIS ${payload.error.code} ${payload.error.message}`);
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function makeArcgisClient() {
  const cache = new Map();
  return async function query(layer) {
    if (!cache.has(layer)) {
      cache.set(layer, (async () => {
        const url = new URL(`${layer.replace(/\/$/, '')}/query`);
        url.searchParams.set('where', '1=1');
        url.searchParams.set('outFields', '*');
        url.searchParams.set('returnGeometry', 'false');
        url.searchParams.set('f', 'json');
        const payload = await fetchJson(url, `ArcGIS query ${layer}`);
        return Array.isArray(payload.features) ? payload.features.map(feature => feature.attributes || {}) : [];
      })());
    }
    return cache.get(layer);
  };
}

async function resolveInstance(spec, query) {
  const rows = await query(spec.serviceUrl);
  const southallRows = rows.filter(containsSouthall);
  const observations = southallRows
    .filter(row => row[spec.fieldId] !== undefined && row[spec.fieldId] !== null && row[spec.fieldId] !== '')
    .map(row => ({ place: placeLabel(row, spec.geography), value: row[spec.fieldId], fieldId: spec.fieldId }))
    .sort((a, b) => a.place.localeCompare(b.place, undefined, { numeric: true, sensitivity: 'base' }));

  return {
    date: spec.date,
    geography: { name: spec.geography },
    observations,
    matchedRows: southallRows.length,
    serviceUrl: spec.serviceUrl,
    fieldId: spec.fieldId,
    unit: spec.unit || null,
    summary: spec.categorical ? { kind: 'distribution', values: categoricalSummary(observations) } : { kind: 'numeric', values: numericSummary(observations) }
  };
}

async function buildProbe() {
  const started = Date.now();
  const query = makeArcgisClient();

  const geographyDiagnostics = await Promise.all(GEOGRAPHIES.map(async geo => {
    try {
      const rows = await query(geo.serviceUrl);
      return { id: geo.id, name: geo.name, matchedFeatures: rows.filter(containsSouthall).length };
    } catch (error) {
      return { id: geo.id, name: geo.name, matchedFeatures: 0, error: String(error?.message || error) };
    }
  }));

  const groups = [];
  for (const group of GROUPS) {
    const indicators = [];
    for (const indicator of group.indicators) {
      const instances = [];
      for (const spec of indicator.instances) {
        try {
          instances.push(await resolveInstance(spec, query));
        } catch (error) {
          instances.push({ date: spec.date, geography: { name: spec.geography }, observations: [], error: String(error?.message || error) });
        }
      }
      indicators.push({
        id: indicator.id,
        name: indicator.name,
        dataType: indicator.dataType || null,
        geography: { name: [...new Set(indicator.instances.map(item => item.geography))].join(' + ') },
        instances
      });
    }
    groups.push({ id: group.id, label: group.label, note: group.note, candidates: group.indicators.length, indicators });
  }

  const hasObservations = groups.some(group => group.indicators.some(indicator => indicator.instances.some(item => item.observations?.length)));
  return {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    status: hasObservations ? 'ok' : 'empty',
    place: 'Southall',
    scope: 'Exploratory evidence probe — exact published observations only; no synthetic Ward/Town aggregation',
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
        'cache-control': 'public, max-age=900, stale-while-revalidate=3600'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ status: 'error', error: String(error?.message || error), generatedAt: new Date().toISOString() }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
    });
  }
};

export const config = { path: '/api/ealing-data-probe' };
