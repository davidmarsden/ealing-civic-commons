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

const SOUTHALL_TOWN_WARDS = [
  'Dormers Wells',
  'Lady Margaret',
  'Norwood Green',
  'Southall Broadway',
  'Southall Green',
  'Southall West'
];

const EALING_SOUTHALL_CONTEXT_WARDS = ['Hanwell Broadway', 'Northfield', 'Walpole'];

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
    note: 'These are Ealing Data indicator values, not identified local monitor readings. The data returned by this probe does not say where a monitor was located, what type of monitor was used, or whether a value is measured, modelled or a background/ambient estimate. Maps use the Ealing-wide LSOA range so small Southall differences are not visually exaggerated.',
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
    note: 'Unlike the IMD-derived indicators, Ealing publishes populated Ward and Town Profile rows here. Southall town is treated as six wards: Dormers Wells, Lady Margaret, Norwood Green, Southall Broadway, Southall Green and Southall West.',
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
    note: 'This field is repeated on the LSOA-shaped service, but the published value is borough-wide rather than a neighbourhood breakdown. The probe therefore collapses the repeated rows to one Ealing borough figure and does not draw an LSOA choropleth.',
    indicators: [
      { id: 'I44455', name: 'Core homelessness rate (% of households)', dataType: 'rate', instances: [instance('2020–2023', 'LSOA 2021', IMD_LSOA, 'ID44455D20200101000000', { mode: 'borough-repeated', unit: '%', boroughRepeated: true })] }
    ]
  }
];

function textValues(row) {
  return Object.values(row || {}).filter(value => typeof value === 'string' && value.trim());
}

function rowName(row) {
  return String(row?.NAME || row?.WardName || row?.TownName || '').trim();
}

function isSouthallTownRow(row, geography) {
  if (geography === 'LSOA 2021') {
    return String(row?.ETWNE909Name || '').trim().toLowerCase() === 'southall';
  }
  if (geography === 'Ward') {
    return SOUTHALL_TOWN_WARDS.includes(rowName(row));
  }
  if (geography === 'Town Profile') {
    return rowName(row).toLowerCase() === 'southall';
  }
  return textValues(row).some(value => /southall/i.test(value));
}

function areaMetadata(row, geography) {
  if (geography === 'LSOA 2021') {
    const name = String(row?.NAME || row?.LSOA2021Name || row?.LSOA21NM || 'LSOA');
    const code = String(row?.LSOA2021Code || row?.LSOA21CD || '');
    const wardName = String(row?.WardName || '');
    const townName = String(row?.ETWNE909Name || 'Southall');
    return {
      name,
      code,
      wardName,
      townName,
      msoaName: String(row?.MSOA2021Name || row?.MSOAName || '')
    };
  }
  const name = rowName(row) || 'Southall';
  return {
    name,
    code: String(row?.WardCode || row?.ETWNE909Code || ''),
    wardName: geography === 'Ward' ? name : '',
    townName: geography === 'Town Profile' ? name : 'Southall',
    msoaName: ''
  };
}

function friendlyPlace(area, geography) {
  if (geography === 'LSOA 2021') {
    return area.wardName ? `${area.wardName} — ${area.name}` : area.name;
  }
  return area.name;
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

  async function query(layer, { geometry = false, outFields = '*' } = {}) {
    const key = `${layer}|${geometry ? 'geometry' : 'attributes'}|${outFields}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const url = new URL(`${layer.replace(/\/$/, '')}/query`);
        url.searchParams.set('where', '1=1');
        url.searchParams.set('outFields', outFields);
        url.searchParams.set('returnGeometry', geometry ? 'true' : 'false');
        if (geometry) {
          url.searchParams.set('outSR', '4326');
          url.searchParams.set('geometryPrecision', '5');
          url.searchParams.set('maxAllowableOffset', '0.00005');
        }
        url.searchParams.set('f', 'json');
        const payload = await fetchJson(url, `ArcGIS query ${layer}`);
        return Array.isArray(payload.features) ? payload.features : [];
      })());
    }
    return cache.get(key);
  }

  return {
    async attributes(layer) {
      return (await query(layer)).map(feature => feature.attributes || {});
    },
    async geometry(layer, outFields) {
      return query(layer, { geometry: true, outFields });
    }
  };
}

function observationsFromRows(rows, spec, filterFn) {
  return rows
    .filter(filterFn)
    .filter(row => row[spec.fieldId] !== undefined && row[spec.fieldId] !== null && row[spec.fieldId] !== '')
    .map(row => {
      const area = areaMetadata(row, spec.geography);
      return {
        place: friendlyPlace(area, spec.geography),
        area,
        value: row[spec.fieldId],
        fieldId: spec.fieldId
      };
    })
    .sort((a, b) => a.place.localeCompare(b.place, undefined, { numeric: true, sensitivity: 'base' }));
}

async function resolveInstance(spec, client) {
  const rows = await client.attributes(spec.serviceUrl);
  const southallObservations = observationsFromRows(rows, spec, row => isSouthallTownRow(row, spec.geography));
  const ealingObservations = observationsFromRows(rows, spec, () => true);

  if (spec.boroughRepeated) {
    const uniqueValues = [...new Set(ealingObservations.map(item => String(item.value)))];
    if (uniqueValues.length !== 1) {
      throw new Error(`Expected one repeated borough-wide value for ${spec.fieldId}, found ${uniqueValues.length}`);
    }
    const value = ealingObservations[0]?.value;
    const observations = [{
      place: 'Ealing borough',
      area: { name: 'Ealing borough', code: '', wardName: '', townName: '', msoaName: '' },
      value,
      fieldId: spec.fieldId
    }];
    return {
      date: spec.date,
      geography: { name: 'Ealing borough' },
      observations,
      matchedRows: ealingObservations.length,
      serviceUrl: spec.serviceUrl,
      fieldId: spec.fieldId,
      unit: spec.unit || null,
      summary: { kind: 'numeric', values: numericSummary(observations) },
      comparator: null,
      scopeNote: `The source service repeats the same borough-wide value across ${ealingObservations.length} LSOA-shaped rows; no neighbourhood variation is published here.`
    };
  }

  const summary = spec.categorical
    ? { kind: 'distribution', values: categoricalSummary(southallObservations) }
    : { kind: 'numeric', values: numericSummary(southallObservations) };
  const comparator = spec.categorical
    ? { label: `Ealing ${spec.geography} distribution`, kind: 'distribution', values: categoricalSummary(ealingObservations) }
    : { label: `Ealing ${spec.geography} median`, kind: 'numeric', values: numericSummary(ealingObservations) };

  return {
    date: spec.date,
    geography: { name: spec.geography },
    observations: southallObservations,
    matchedRows: southallObservations.length,
    serviceUrl: spec.serviceUrl,
    fieldId: spec.fieldId,
    unit: spec.unit || null,
    summary,
    comparator
  };
}

function mapFeature(feature, scope = null) {
  const row = feature.attributes || {};
  return {
    name: rowName(row) || String(row?.LSOA2021Name || ''),
    code: String(row?.WardCode || row?.LSOA2021Code || row?.LSOA21CD || ''),
    wardName: String(row?.WardName || ''),
    townName: String(row?.ETWNE909Name || ''),
    scope,
    geometry: feature.geometry || null
  };
}

async function buildMaps(client) {
  const wardGeo = GEOGRAPHIES.find(item => item.name === 'Ward');
  const lsoaGeo = GEOGRAPHIES.find(item => item.name === 'LSOA 2021');
  const [wardFeatures, lsoaFeatures] = await Promise.all([
    client.geometry(wardGeo.serviceUrl, 'WardCode,NAME'),
    client.geometry(lsoaGeo.serviceUrl, 'LSOA2021Code,NAME,WardName,ETWNE909Name')
  ]);

  const wards = wardFeatures
    .map(feature => {
      const name = rowName(feature.attributes || {});
      const scope = SOUTHALL_TOWN_WARDS.includes(name)
        ? 'southall-town'
        : EALING_SOUTHALL_CONTEXT_WARDS.includes(name)
          ? 'constituency-context'
          : 'ealing-context';
      return mapFeature(feature, scope);
    })
    .filter(item => item.geometry);

  const lsoas = lsoaFeatures
    .filter(feature => isSouthallTownRow(feature.attributes || {}, 'LSOA 2021'))
    .map(feature => mapFeature(feature, 'southall-town'))
    .filter(item => item.geometry);

  return {
    wards,
    lsoas,
    scope: {
      southallTownWards: SOUTHALL_TOWN_WARDS,
      constituencyContextWards: EALING_SOUTHALL_CONTEXT_WARDS,
      note: 'Southall town evidence uses the six Southall town wards. Hanwell Broadway, Northfield and Walpole are shown only as Ealing Southall parliamentary constituency context and are not added to Southall town statistics.'
    }
  };
}

export async function buildProbe() {
  const started = Date.now();
  const client = makeArcgisClient();

  const geographyDiagnostics = await Promise.all(GEOGRAPHIES.map(async geo => {
    try {
      const rows = await client.attributes(geo.serviceUrl);
      return { id: geo.id, name: geo.name, matchedFeatures: rows.filter(row => isSouthallTownRow(row, geo.name)).length };
    } catch (error) {
      return { id: geo.id, name: geo.name, matchedFeatures: 0, error: String(error?.message || error) };
    }
  }));

  const [maps, groups] = await Promise.all([
    buildMaps(client),
    (async () => {
      const resolvedGroups = [];
      for (const group of GROUPS) {
        const indicators = [];
        for (const indicator of group.indicators) {
          const instances = [];
          for (const spec of indicator.instances) {
            try {
              instances.push(await resolveInstance(spec, client));
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
        resolvedGroups.push({ id: group.id, label: group.label, note: group.note, candidates: group.indicators.length, indicators });
      }
      return resolvedGroups;
    })()
  ]);

  const hasObservations = groups.some(group => group.indicators.some(indicator => indicator.instances.some(item => item.observations?.length)));
  return {
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    status: hasObservations ? 'ok' : 'empty',
    place: 'Southall',
    scope: 'Exploratory evidence probe — exact published observations only; no synthetic Ward/Town aggregation',
    provenance: { dataExplorer: EXPLORER, masterTable: MASTER_TABLE },
    geographyDiagnostics,
    maps,
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
