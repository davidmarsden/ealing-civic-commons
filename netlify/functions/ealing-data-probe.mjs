const MASTER_TABLE = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/arcgis/rest/services/Ealing_MasterTable/FeatureServer/0';
const EXPLORER = 'https://data.ealing.gov.uk/data-catalog-explorer/';
const USER_AGENT = 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)';

const IMD_WARD = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_IMD/FeatureServer/2';
const IMD_TOWN = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_IMD/FeatureServer/5';
const LOW_INCOME_WARD = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_LowIncFam_Ahc_Rel/FeatureServer/1';
const LOW_INCOME_TOWN = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_LowIncFam_Ahc_Rel/FeatureServer/4';

const GEOGRAPHIES = [
  { id: 'G7', name: 'Ward', serviceUrl: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/2' },
  { id: 'G109', name: 'Town Profile', serviceUrl: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/5' },
  { id: 'G113', name: 'LSOA 2021', serviceUrl: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/6' }
];

function instance(date, geography, serviceUrl, fieldId, unit = null) {
  return { date, geography, serviceUrl, fieldId, unit };
}

const GROUPS = [
  {
    id: 'imd',
    label: 'Deprivation / IMD',
    indicators: [
      {
        id: 'I3091',
        name: 'Index of Multiple Deprivation (IMD) Score',
        dataType: 'score',
        instances: [
          instance('2015', 'Ward', IMD_WARD, 'ID3091D20150101000000'),
          instance('2019', 'Ward', IMD_WARD, 'ID3091D20190101000000'),
          instance('2025', 'Ward', IMD_WARD, 'ID3091D20250101000000'),
          instance('2015', 'Town Profile', IMD_TOWN, 'ID3091D20150101000000'),
          instance('2019', 'Town Profile', IMD_TOWN, 'ID3091D20190101000000'),
          instance('2025', 'Town Profile', IMD_TOWN, 'ID3091D20250101000000')
        ]
      },
      {
        id: 'I3089',
        name: 'Index of Multiple Deprivation (IMD) Decile',
        dataType: 'decile',
        instances: [
          instance('2015', 'Town Profile', IMD_TOWN, 'ID3089D20150101000000'),
          instance('2019', 'Town Profile', IMD_TOWN, 'ID3089D20190101000000'),
          instance('2025', 'Town Profile', IMD_TOWN, 'ID3089D20250101000000')
        ]
      }
    ]
  },
  {
    id: 'air-quality',
    label: 'Air quality',
    indicators: [
      { id: 'I25375', name: 'Air quality indicator', instances: [instance('2023', 'Ward', IMD_WARD, 'ID25375D20230101000000'), instance('2023', 'Town Profile', IMD_TOWN, 'ID25375D20230101000000')] },
      { id: 'I30920', name: 'Benzene (component of air quality indicator)', instances: [instance('2023', 'Ward', IMD_WARD, 'ID30920D20230101000000'), instance('2023', 'Town Profile', IMD_TOWN, 'ID30920D20230101000000')] },
      { id: 'I30919', name: 'Nitrogen dioxide (component of air quality indicator)', instances: [instance('2023', 'Ward', IMD_WARD, 'ID30919D20230101000000'), instance('2023', 'Town Profile', IMD_TOWN, 'ID30919D20230101000000')] },
      { id: 'I30922', name: 'Particulates (component of air quality indicator)', instances: [instance('2023', 'Ward', IMD_WARD, 'ID30922D20230101000000'), instance('2023', 'Town Profile', IMD_TOWN, 'ID30922D20230101000000')] }
    ]
  },
  {
    id: 'overcrowding',
    label: 'Housing / overcrowding',
    indicators: [
      { id: 'I44458', name: 'Household overcrowding indicator (bedrooms)', instances: [instance('2021', 'Ward', IMD_WARD, 'ID44458D20210101000000', '%'), instance('2021', 'Town Profile', IMD_TOWN, 'ID44458D20210101000000', '%')] }
    ]
  },
  {
    id: 'child-poverty',
    label: 'Child poverty / low income',
    indicators: [
      { id: 'I44674', name: 'After Housing Cost - Relative Low Income, age 0–15 rate', dataType: 'rate', instances: [instance('2024/25', 'Ward', LOW_INCOME_WARD, 'ID44674D2024', '%'), instance('2024/25', 'Town Profile', LOW_INCOME_TOWN, 'ID44674D2024', '%')] },
      { id: 'I44704', name: 'After Housing Cost - Children in Relative Low Income Families, total', dataType: 'count', instances: [instance('2024/25', 'Ward', LOW_INCOME_WARD, 'ID44704D2024'), instance('2024/25', 'Town Profile', LOW_INCOME_TOWN, 'ID44704D2024')] }
    ]
  },
  {
    id: 'homelessness',
    label: 'Homelessness',
    indicators: [
      { id: 'I44455', name: 'Core homelessness rate (% of households)', dataType: 'rate', instances: [instance('2020–2023', 'Ward', IMD_WARD, 'ID44455D20200101000000', '%'), instance('2020–2023', 'Town Profile', IMD_TOWN, 'ID44455D20200101000000', '%')] }
    ]
  }
];

function textValues(row) {
  return Object.values(row || {}).filter(value => typeof value === 'string' && value.trim());
}

function containsSouthall(row) {
  return textValues(row).some(value => value.toLowerCase().includes('southall'));
}

function placeLabel(row) {
  const preferred = ['TownName', 'Town_Name', 'WardName', 'Ward_Name', 'LSOA21NM', 'LSOAName', 'Name', 'NAME'];
  for (const key of preferred) if (row?.[key]) return String(row[key]);
  return textValues(row).find(value => value.toLowerCase().includes('southall')) || 'Southall area';
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
      const resolvedInstances = await Promise.all(indicator.instances.map(async spec => {
        try {
          const rows = await query(spec.serviceUrl);
          const matches = rows.filter(containsSouthall);
          const observations = matches
            .filter(row => row[spec.fieldId] !== undefined && row[spec.fieldId] !== null && row[spec.fieldId] !== '')
            .map(row => ({ place: placeLabel(row), value: row[spec.fieldId], fieldId: spec.fieldId }));
          return {
            date: spec.date,
            geography: { name: spec.geography },
            observations,
            matchedRows: matches.length,
            serviceUrl: spec.serviceUrl,
            fieldId: spec.fieldId,
            unit: spec.unit
          };
        } catch (error) {
          return { date: spec.date, geography: { name: spec.geography }, observations: [], error: String(error?.message || error) };
        }
      }));
      indicators.push({
        id: indicator.id,
        name: indicator.name,
        dataType: indicator.dataType || null,
        geography: { name: 'Ward + Town Profile' },
        instances: resolvedInstances
      });
    }
    groups.push({ id: group.id, label: group.label, candidates: group.indicators.length, indicators });
  }

  const hasObservations = groups.some(group => group.indicators.some(indicator => indicator.instances.some(item => item.observations.length)));
  return {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    status: hasObservations ? 'ok' : 'empty',
    place: 'Southall',
    scope: 'Exploratory evidence probe — curated from the 31 August 2026 Ealing master-table snapshot; not yet production ingestion',
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
