import { writeFile } from 'node:fs/promises';
import { EALING_COUNCILLORS } from '../netlify/lib/ealing-councillors.mjs';
import { EALING_2026_CANDIDACIES } from '../netlify/lib/ealing-election-candidates.mjs';

const OUTPUT = new URL('../netlify/lib/ealing-candidacy-history.mjs', import.meta.url);
const CANDIDATES_CSV = 'https://electionresults.uk/data/candidates.csv';
const RACES_CSV = 'https://electionresults.uk/data/races.csv';
const CYCLES_CSV = 'https://electionresults.uk/data/cycles.csv';
const COUNCIL_SLUG = 'ealing';
const HISTORICAL_YEARS = new Set(['2018', '2022']);

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift()?.map(value => value.trim()) || [];
  return rows.filter(values => values.some(Boolean)).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

async function fetchCsv(url) {
  const response = await fetch(url, { headers: { accept: 'text/csv,*/*;q=0.8', 'user-agent': 'Ealing-Civic-Commons/1.0 candidacy-history-refresh' } });
  if (!response.ok) throw new Error(`Election data HTTP ${response.status}: ${url}`);
  return parseCsv(await response.text());
}

function boundaryEra(year) {
  if (Number(year) < 2022) return {
    id: 'ealing-pre-2022',
    label: 'Pre-2022 Ealing ward boundaries',
    note: 'Ward names are preserved as recorded for the election cycle and must not be assumed to describe the same geography as post-2022 wards.'
  };
  return {
    id: 'ealing-2022-current',
    label: '2022 Ealing ward boundaries',
    note: 'Ward geography used from the May 2022 all-out election onward.'
  };
}

function nameTokens(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function historicalSignature(value) {
  const tokens = nameTokens(value);
  if (tokens.length < 2) return null;

  // electionresults.uk historical rows use surname-first abbreviated forms such
  // as "Donnelly S." and "van de Geer M.". The final token is the given-name
  // initial; the token immediately before it is the surname core.
  const final = tokens[tokens.length - 1];
  return {
    surnameCore: tokens[tokens.length - 2],
    firstInitial: final[0]
  };
}

function currentSourceSignature(value) {
  const tokens = nameTokens(value);
  if (tokens.length < 2) return null;

  // The direct Ealing Council importer has already converted source rows into
  // normal given-name-first display order. Never infer name order from token
  // length here: short surnames such as Roy are perfectly valid surnames.
  return {
    surnameCore: tokens[tokens.length - 1],
    firstInitial: tokens[0][0]
  };
}

function recordSignature(record) {
  return record.electionYear === 2026
    ? currentSourceSignature(record.candidateNameSource)
    : historicalSignature(record.candidateNameSource);
}

function personSignatures(person) {
  return [person.name, ...(person.aliases || [])]
    .map(value => {
      const tokens = nameTokens(value.replace(/^(?:councillor|cllr)\s+/i, ''));
      return tokens.length >= 2 ? { surnameCore: tokens[tokens.length - 1], firstInitial: tokens[0][0] } : null;
    })
    .filter(Boolean);
}

function unmatched(method = null) {
  return { status: 'unmatched', route: null, method, confidence: null };
}

function resolveCurrentCouncillor(record) {
  const signature = recordSignature(record);
  if (!signature?.surnameCore || !signature.firstInitial) return unmatched();

  let candidates = EALING_COUNCILLORS.filter(person => personSignatures(person).some(sig =>
    sig.surnameCore === signature.surnameCore && sig.firstInitial === signature.firstInitial
  ));

  // 2026 is the current council term. A 2026 candidacy must therefore agree
  // with the current councillor's ward; a unique surname/initial match in a
  // different ward is not enough and must never be published as high confidence.
  if (record.electionYear === 2026) {
    if (!record.ward?.name) return unmatched('missing-current-term-ward');
    const wardMatches = candidates.filter(person => String(person.ward).toLowerCase() === String(record.ward.name).toLowerCase());
    if (wardMatches.length !== 1) {
      return wardMatches.length > 1
        ? { status: 'ambiguous', route: null, method: 'current-term-name-and-ward-collision', confidence: null }
        : unmatched('current-term-ward-mismatch');
    }
    candidates = wardMatches;
  } else if (record.electionYear === 2022 && record.ward?.name) {
    // 2022 uses the current boundary era, so matching ward is useful evidence,
    // but councillors can change wards between elections. Keep it corroborative,
    // not mandatory, for historical identity linkage.
    const wardMatches = candidates.filter(person => String(person.ward).toLowerCase() === String(record.ward.name).toLowerCase());
    if (wardMatches.length === 1) candidates = wardMatches;
  }

  if (candidates.length !== 1) return {
    status: candidates.length > 1 ? 'ambiguous' : 'unmatched',
    route: null,
    method: candidates.length > 1 ? 'surname-core-first-initial-collision' : null,
    confidence: null
  };

  return {
    status: 'matched',
    route: candidates[0].route,
    method: record.electionYear === 2026
      ? 'current-source-given-name-first-plus-required-current-ward'
      : record.electionYear === 2022
        ? 'historical-surname-initial-with-optional-current-boundary-ward-corroboration'
        : 'historical-surname-initial',
    confidence: record.electionYear === 2026 ? 'high' : record.electionYear === 2022 ? 'high' : 'medium',
    reviewState: 'algorithmic'
  };
}

function upstreamForYear(year) {
  if (Number(year) < 2021) return {
    name: "Andrew Teale's Local Elections Archive Project",
    url: 'https://www.andrewteale.me.uk/leap/elections-index/#E',
    license: 'CC BY-SA 3.0',
    relationship: 'electionresults.uk pre-2021 source'
  };
  return {
    name: 'House of Commons Library Local Election Handbook',
    url: 'https://commonslibrary.parliament.uk/',
    license: 'Open Parliament Licence',
    relationship: 'electionresults.uk 2021–2025 source'
  };
}

const [candidateRows, raceRows, cycleRows] = await Promise.all([
  fetchCsv(CANDIDATES_CSV),
  fetchCsv(RACES_CSV),
  fetchCsv(CYCLES_CSV)
]);
const cycleDates = new Map(cycleRows.map(row => [String(row.year), row.election_date]));
const races = new Map(
  raceRows
    .filter(row => row.council_slug === COUNCIL_SLUG && HISTORICAL_YEARS.has(String(row.year)))
    .map(row => [`${row.year}:${row.ward_slug}`, row])
);

const history = [];
for (const row of candidateRows) {
  const year = String(row.year);
  if (row.council_slug !== COUNCIL_SLUG || !HISTORICAL_YEARS.has(year)) continue;
  const race = races.get(`${year}:${row.ward_slug}`);
  if (!race) continue;
  const electionDate = cycleDates.get(year) || `${year}-01-01`;
  const record = {
    id: `ealing-candidacy:${electionDate}:${row.ward_slug}:${slugify(row.candidate_name)}`,
    council: { name: 'Ealing', slug: COUNCIL_SLUG },
    electionYear: Number(year),
    electionDate,
    electionType: 'local-council',
    electionLabel: `Ealing Council election, ${electionDate}`,
    candidateNameSource: row.candidate_name,
    ward: {
      name: race.ward_name,
      slug: row.ward_slug,
      ecCode: race.ec_code || null,
      boundaryEra: boundaryEra(year)
    },
    ballot: {
      description: row.party,
      canonicalParty: row.party,
      fidelity: 'normalized-by-source',
      note: 'electionresults.uk normalises party names; this is not asserted to be verbatim nomination-paper wording.'
    },
    votes: Number(row.votes),
    result: {
      elected: String(row.elected) === '1',
      rank: row.rank ? Number(row.rank) : null,
      sourceElectedFlag: row.elected_source === '' ? null : String(row.elected_source) === '1'
    },
    provenance: {
      provider: 'electionresults.uk',
      providerUrl: `https://electionresults.uk/councils/ealing/${year}`,
      dataUrl: CANDIDATES_CSV,
      raceDataUrl: RACES_CSV,
      upstream: upstreamForYear(year),
      license: Number(year) < 2021 ? 'CC BY-SA 4.0 for LEAP-derived electionresults.uk download' : 'Open Parliament Licence source data; electionresults.uk derived fields CC BY-SA 4.0'
    }
  };
  record.identity = resolveCurrentCouncillor(record);
  history.push(record);
}

for (const item of EALING_2026_CANDIDACIES) {
  const record = {
    id: item.id.replace('ealing-election:', 'ealing-candidacy:'),
    council: { name: 'Ealing', slug: COUNCIL_SLUG },
    electionYear: 2026,
    electionDate: item.electionDate,
    electionType: item.electionDate === '2026-06-25' ? 'local-council-by-election' : 'local-council',
    electionLabel: item.electionLabel,
    candidateNameSource: item.name,
    ward: {
      name: item.ward,
      slug: slugify(item.ward),
      ecCode: null,
      boundaryEra: boundaryEra('2026')
    },
    ballot: {
      description: item.party,
      canonicalParty: item.party,
      fidelity: 'source-page-text',
      note: 'Copied from the Ealing Council published result table.'
    },
    votes: item.votes,
    result: { elected: item.elected, rank: null, sourceElectedFlag: item.elected },
    provenance: {
      provider: 'Ealing Council',
      providerUrl: item.sourceUrl,
      dataUrl: item.sourceUrl,
      upstream: null,
      license: null
    }
  };
  record.identity = resolveCurrentCouncillor(record);
  history.push(record);
}

history.sort((a, b) => b.electionDate.localeCompare(a.electionDate) || a.ward.name.localeCompare(b.ward.name) || a.candidateNameSource.localeCompare(b.candidateNameSource));
const meta = {
  council: 'Ealing',
  cycles: [...new Set(history.map(record => record.electionYear))].sort(),
  recordCount: history.length,
  matchedCurrentProfiles: history.filter(record => record.identity.status === 'matched').length,
  ambiguousIdentityMatches: history.filter(record => record.identity.status === 'ambiguous').length,
  sources: [
    { name: 'Ealing Council', years: [2026], role: 'direct official result pages' },
    { name: 'electionresults.uk', years: [2018, 2022], role: 'structured historical adapter' },
    { name: "Andrew Teale's Local Elections Archive Project", years: [2018], role: 'upstream source via electionresults.uk' },
    { name: 'House of Commons Library Local Election Handbook', years: [2022], role: 'upstream source via electionresults.uk' }
  ],
  generatedAt: new Date().toISOString(),
  generated: true
};

if (history.filter(record => record.electionYear === 2018).length < 150) throw new Error('2018 candidacy history unexpectedly sparse');
if (history.filter(record => record.electionYear === 2022).length < 150) throw new Error('2022 candidacy history unexpectedly sparse');
if (history.filter(record => record.electionYear === 2026).length < 200) throw new Error('2026 candidacy history unexpectedly sparse');

const moduleText = `// Generated structured Ealing candidacy history. Identity links are separate, confidence-labelled assertions.\nexport const EALING_CANDIDACY_HISTORY = ${JSON.stringify(history, null, 2)};\nexport const EALING_CANDIDACY_HISTORY_META = ${JSON.stringify(meta, null, 2)};\n`;
await writeFile(OUTPUT, moduleText, 'utf8');
console.log(`Generated ${history.length} structured Ealing candidacy records across ${meta.cycles.join(', ')}.`);
