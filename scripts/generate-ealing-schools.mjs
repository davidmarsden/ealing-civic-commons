import { writeFile } from 'node:fs/promises';

const LA_CODE = '307';
const OUTPUT = new URL('../netlify/lib/ealing-schools.mjs', import.meta.url);
const BASE = 'https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata';
const OPEN_STATUSES = new Set(['Open', 'Open, but proposed to close']);

const TOWN_BY_WARD = new Map([
  ['East Acton','Acton'], ['North Acton','Acton'], ['South Acton','Acton'],
  ['Ealing Broadway','Ealing'], ['Ealing Common','Ealing'], ['Hanger Hill','Ealing'], ['Northfield','Ealing'], ['Pitshanger','Ealing'], ['Southfield','Ealing'], ['Walpole','Ealing'],
  ['Central Greenford','Greenford'], ['Greenford Broadway','Greenford'], ['North Greenford','Greenford'],
  ['Hanwell Broadway','Hanwell'], ['North Hanwell','Hanwell'],
  ['Northolt Mandeville','Northolt'], ['Northolt West End','Northolt'],
  ['Perivale','Perivale'],
  ['Dormers Wells','Southall'], ['Lady Margaret','Southall'], ['Norwood Green','Southall'], ['Southall Broadway','Southall'], ['Southall Green','Southall'], ['Southall West','Southall']
]);

// GIAS supplies the canonical current identity. Some establishments already have a
// reviewed Southall-Zettel civic-memory entity containing historical reporting and
// relationships. Bind those explicitly by immutable URN: do not fuzzy-match names.
const SOUTHALL_ZETTEL_BINDINGS_BY_URN = new Map([
  ['101892', 'entity:blair-peach-primary-school']
]);

function yyyymmdd(date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '');
}

async function fetchLatest() {
  const today = new Date();
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const sourceDate = yyyymmdd(date);
    const url = `${BASE}${sourceDate}.csv`;
    const response = await fetch(url, { headers: { accept: 'text/csv,*/*;q=0.8', 'user-agent': 'Ealing-Civic-Commons/1.0 bulk-data-refresh' } });
    if (!response.ok) continue;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 1_000_000) continue;
    return { sourceDate, url, text: new TextDecoder('windows-1252').decode(bytes) };
  }
  throw new Error('No recent GIAS public bulk CSV was available');
}

function* csvRows(csv) {
  let row = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); yield row; row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); yield row; }
}

function townFor(record) {
  const ward = record['AdministrativeWard (name)'];
  if (TOWN_BY_WARD.has(ward)) return TOWN_BY_WARD.get(ward);
  const text = `${record.Town || ''} ${record.Locality || ''} ${record.Street || ''}`.toLowerCase();
  for (const town of ['Southall','Greenford','Northolt','Hanwell','Perivale','Acton','Ealing']) if (text.includes(town.toLowerCase())) return town;
  return null;
}

function institutionTypeFor(record) {
  const phase = record['PhaseOfEducation (name)'];
  const fe = record['FurtherEducationType (name)'];
  if (fe && !/^Not applicable$/i.test(fe)) return 'College / further education';
  if (phase && !/^Not applicable$/i.test(phase)) return `${phase} school`;
  return record['TypeOfEstablishment (name)'] || 'Educational establishment';
}

function descriptionFor(record, town) {
  const phase = record['PhaseOfEducation (name)'];
  const type = record['TypeOfEstablishment (name)'];
  const ages = record.StatutoryLowAge && record.StatutoryHighAge ? ` Ages ${record.StatutoryLowAge} to ${record.StatutoryHighAge}.` : '';
  const place = town ? ` in ${town}` : ' in the London Borough of Ealing';
  const phaseText = phase && !/^Not applicable$/i.test(phase) ? `${phase.toLowerCase()} education` : 'education';
  return `A current ${type ? type.toLowerCase() : 'educational establishment'} providing ${phaseText}${place}.${ages}`;
}

const { sourceDate, url, text } = await fetchLatest();
const iterator = csvRows(text);
const first = iterator.next();
if (first.done) throw new Error('GIAS public bulk CSV was empty');
const headers = first.value.map(value => value.replace(/^\uFEFF/, ''));
const entities = [];
for (const values of iterator) {
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  if (record['LA (code)'] !== LA_CODE) continue;
  if (!OPEN_STATUSES.has(record['EstablishmentStatus (name)'])) continue;
  const urn = String(record.URN || '').trim();
  const name = String(record.EstablishmentName || '').trim();
  if (!urn || !name) continue;
  const town = townFor(record);
  const ward = record['AdministrativeWard (name)'] || null;
  const phase = record['PhaseOfEducation (name)'] || null;
  const establishmentType = record['TypeOfEstablishment (name)'] || null;
  const postcode = record.Postcode || null;
  const historicalEntityId = SOUTHALL_ZETTEL_BINDINGS_BY_URN.get(urn);
  const providers = [{ provider: 'civic-commons', role: 'canonical-public-identity' }];
  if (historicalEntityId) {
    providers.push({
      provider: 'southall-zettel',
      entityId: historicalEntityId,
      role: 'reviewed-civic-memory'
    });
  }
  entities.push({
    route: `organisations/school-${urn}`,
    id: `civic:organisation:gias:${urn}`,
    name,
    type: 'organisation',
    description: descriptionFor(record, town),
    aliases: [],
    town,
    ward,
    institutionType: institutionTypeFor(record),
    phase,
    establishmentType,
    postcode,
    urn,
    status: record['EstablishmentStatus (name)'],
    website: { label: `Get Information about Schools — URN ${urn}`, url: `https://get-information-schools.service.gov.uk/Establishments/Establishment/Details/${urn}`, type: 'Department for Education establishment register' },
    providers
  });
}
entities.sort((a, b) => a.name.localeCompare(b.name));
if (entities.length < 80) throw new Error(`GIAS Ealing import unexpectedly returned only ${entities.length} open establishments`);
const moduleText = `// Generated from the Department for Education Get Information about Schools public bulk download.\nexport const EALING_SCHOOLS = ${JSON.stringify(entities, null, 2)};\nexport const EALING_SCHOOLS_META = ${JSON.stringify({ source: 'Get Information about Schools (GIAS)', sourceUrl: url, localAuthorityCode: LA_CODE, generatedAt: new Date().toISOString(), sourceDate, count: entities.length, degraded: false }, null, 2)};\nexport function findEalingSchoolByRoute(value) { const route = String(value || '').trim().replace(/^\\/+|\\/+$/g, '').replace(/\\.html$/i, ''); return EALING_SCHOOLS.find(entity => entity.route === route) || null; }\n`;
await writeFile(OUTPUT, moduleText, 'utf8');
console.log(`Generated ${entities.length} current Ealing GIAS establishments from ${sourceDate}.`);
