const USER_AGENT = 'Southall-Ealing-Civic-Commons/0.1 (+public-interest prototype)';
const IMD_LSOA = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_IMD/FeatureServer/6';
const LOW_INCOME_WARD = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_LowIncFam_Ahc_Rel/FeatureServer/1';
const LOW_INCOME_TOWN = 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_Dep_LowIncFam_Ahc_Rel/FeatureServer/4';

const SOUTHALL_WARDS = new Set(['Dormers Wells','Lady Margaret','Norwood Green','Southall Broadway','Southall Green','Southall West']);

const specs = [
  { group:'imd', groupLabel:'Deprivation / IMD', note:'Published LSOA values.', id:'I3091', name:'Index of Multiple Deprivation (IMD) Score', dataType:'score', date:'2025', geography:'LSOA 2021', serviceUrl:IMD_LSOA, fieldId:'ID3091D20250101000000' },
  { group:'imd', groupLabel:'Deprivation / IMD', note:'Published LSOA values.', id:'I3089', name:'Index of Multiple Deprivation (IMD) Decile', dataType:'decile', date:'2025', geography:'LSOA 2021', serviceUrl:IMD_LSOA, fieldId:'ID3089D20250101000000', categorical:true },
  { group:'overcrowding', groupLabel:'Housing / overcrowding', note:'The source field is labelled “Household overcrowding indicator (bedrooms)”. Values are retained in Ealing’s published units.', id:'I44458', name:'Household overcrowding indicator (bedrooms)', date:'2021', geography:'LSOA 2021', serviceUrl:IMD_LSOA, fieldId:'ID44458D20210101000000' },
  { group:'child-poverty', groupLabel:'Child poverty / low income', note:'Southall town is treated as six wards.', id:'I44674', name:'After Housing Cost - Relative Low Income, age 0–15 rate', dataType:'rate', date:'2024/25', geography:'Ward', serviceUrl:LOW_INCOME_WARD, fieldId:'ID44674D2024', unit:'%' },
  { group:'child-poverty', groupLabel:'Child poverty / low income', note:'Southall town is treated as six wards.', id:'I44674', name:'After Housing Cost - Relative Low Income, age 0–15 rate', dataType:'rate', date:'2024/25', geography:'Town Profile', serviceUrl:LOW_INCOME_TOWN, fieldId:'ID44674D2024', unit:'%' },
  { group:'child-poverty', groupLabel:'Child poverty / low income', note:'Southall town is treated as six wards.', id:'I44704', name:'After Housing Cost - Children in Relative Low Income Families, total', dataType:'count', date:'2024/25', geography:'Ward', serviceUrl:LOW_INCOME_WARD, fieldId:'ID44704D2024' },
  { group:'child-poverty', groupLabel:'Child poverty / low income', note:'Southall town is treated as six wards.', id:'I44704', name:'After Housing Cost - Children in Relative Low Income Families, total', dataType:'count', date:'2024/25', geography:'Town Profile', serviceUrl:LOW_INCOME_TOWN, fieldId:'ID44704D2024' },
  { group:'homelessness', groupLabel:'Homelessness', note:'The published value is borough-wide even though it is repeated on an LSOA-shaped service.', id:'I44455', name:'Core homelessness rate (% of households)', dataType:'rate', date:'2020–2023', geography:'Ealing borough', sourceGeography:'LSOA 2021', serviceUrl:IMD_LSOA, fieldId:'ID44455D20200101000000', unit:'%', boroughRepeated:true }
];

async function query(serviceUrl) {
  const url = new URL(`${serviceUrl}/query`);
  url.searchParams.set('where','1=1');
  url.searchParams.set('outFields','*');
  url.searchParams.set('returnGeometry','false');
  url.searchParams.set('f','json');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers:{ accept:'application/json', 'user-agent':USER_AGENT } });
    if (!response.ok) throw new Error(`ArcGIS ${response.status} for ${serviceUrl}`);
    const body = await response.json();
    if (body?.error) throw new Error(`ArcGIS ${body.error.code}: ${body.error.message}`);
    return (body.features || []).map(feature => feature.attributes || {});
  } finally { clearTimeout(timeout); }
}

function rowName(row) { return String(row.NAME || row.WardName || row.TownName || '').trim(); }
function area(row, geography) {
  if (geography === 'LSOA 2021') {
    const name = String(row.NAME || row.LSOA2021Name || row.LSOA21NM || 'LSOA');
    return { name, code:String(row.LSOA2021Code || row.LSOA21CD || ''), wardName:String(row.WardName || ''), townName:String(row.ETWNE909Name || 'Southall') };
  }
  const name = rowName(row) || 'Southall';
  return { name, code:String(row.WardCode || row.ETWNE909Code || ''), wardName:geography === 'Ward' ? name : '', townName:geography === 'Town Profile' ? name : 'Southall' };
}
function inSouthall(row, geography) {
  if (geography === 'LSOA 2021') return String(row.ETWNE909Name || '').trim().toLowerCase() === 'southall';
  if (geography === 'Ward') return SOUTHALL_WARDS.has(rowName(row));
  if (geography === 'Town Profile') return rowName(row).toLowerCase() === 'southall';
  return false;
}
function observation(row, spec) {
  const a = area(row, spec.sourceGeography || spec.geography);
  return { place: spec.geography === 'LSOA 2021' && a.wardName ? `${a.wardName} — ${a.name}` : a.name, area:a, value:row[spec.fieldId], fieldId:spec.fieldId };
}
function numeric(values) {
  const rows = values.map(x => Number(x.value)).filter(Number.isFinite).sort((a,b)=>a-b);
  if (!rows.length) return null;
  const m = Math.floor(rows.length/2);
  return { count:rows.length, min:rows[0], median:rows.length%2 ? rows[m] : (rows[m-1]+rows[m])/2, max:rows.at(-1) };
}
function distribution(values) {
  const counts = new Map();
  for (const item of values) counts.set(String(item.value),(counts.get(String(item.value))||0)+1);
  return [...counts].map(([value,count])=>({value,count})).sort((a,b)=>String(a.value).localeCompare(String(b.value),undefined,{numeric:true}));
}

export async function buildProductionEvidenceProbe() {
  const cache = new Map();
  const rowsFor = async url => { if (!cache.has(url)) cache.set(url, query(url)); return cache.get(url); };
  const grouped = new Map();
  for (const spec of specs) {
    const rows = await rowsFor(spec.serviceUrl);
    let instance;
    if (spec.boroughRepeated) {
      const populated = rows.filter(row => row[spec.fieldId] !== null && row[spec.fieldId] !== undefined && row[spec.fieldId] !== '');
      const unique = [...new Set(populated.map(row => String(row[spec.fieldId])))];
      if (unique.length !== 1) throw new Error(`Expected one repeated borough value for ${spec.id}; found ${unique.length}`);
      const observations = [{ place:'Ealing borough', area:{name:'Ealing borough',code:'',wardName:'',townName:''}, value:populated[0][spec.fieldId], fieldId:spec.fieldId }];
      instance = { date:spec.date, geography:{name:'Ealing borough'}, observations, matchedRows:populated.length, serviceUrl:spec.serviceUrl, fieldId:spec.fieldId, unit:spec.unit || null, summary:{kind:'numeric',values:numeric(observations)}, comparator:null, scopeNote:`The source repeats the same borough-wide value across ${populated.length} LSOA-shaped rows; no neighbourhood variation is published here.` };
    } else {
      const populated = rows.filter(row => row[spec.fieldId] !== null && row[spec.fieldId] !== undefined && row[spec.fieldId] !== '');
      const all = populated.map(row => observation(row,spec));
      const southall = populated.filter(row => inSouthall(row,spec.geography)).map(row => observation(row,spec));
      if (!southall.length) throw new Error(`No Southall observations returned for ${spec.id} ${spec.geography}`);
      instance = { date:spec.date, geography:{name:spec.geography}, observations:southall, matchedRows:southall.length, serviceUrl:spec.serviceUrl, fieldId:spec.fieldId, unit:spec.unit || null, summary:spec.categorical ? {kind:'distribution',values:distribution(southall)} : {kind:'numeric',values:numeric(southall)}, comparator:spec.categorical ? {label:`Ealing ${spec.geography} distribution`,kind:'distribution',values:distribution(all)} : {label:`Ealing ${spec.geography} median`,kind:'numeric',values:numeric(all)} };
    }
    if (!grouped.has(spec.group)) grouped.set(spec.group,{id:spec.group,label:spec.groupLabel,note:spec.note,indicators:new Map()});
    const group = grouped.get(spec.group);
    if (!group.indicators.has(spec.id)) group.indicators.set(spec.id,{id:spec.id,name:spec.name,dataType:spec.dataType || null,instances:[]});
    group.indicators.get(spec.id).instances.push(instance);
  }
  return { generatedAt:new Date().toISOString(), groups:[...grouped.values()].map(group=>({...group,indicators:[...group.indicators.values()]})) };
}
