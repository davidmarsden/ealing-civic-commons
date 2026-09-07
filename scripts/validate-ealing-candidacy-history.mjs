import { EALING_CANDIDACY_HISTORY, EALING_CANDIDACY_HISTORY_META } from '../netlify/lib/ealing-candidacy-history.mjs';

const ids = new Set();
const years = new Set();
let errors = 0;

for (const record of EALING_CANDIDACY_HISTORY) {
  if (!record.id || ids.has(record.id)) { console.error('Duplicate or missing candidacy id', record.id); errors += 1; }
  ids.add(record.id);
  years.add(record.electionYear);
  if (!record.electionDate || !record.candidateNameSource || !record.ward?.name || !record.ward?.boundaryEra?.id) {
    console.error('Missing core candidacy fields', record.id); errors += 1;
  }
  if (!record.ballot?.description || !record.ballot?.fidelity) {
    console.error('Missing ballot description/fidelity', record.id); errors += 1;
  }
  if (!Number.isFinite(Number(record.votes)) || Number(record.votes) < 0 || typeof record.result?.elected !== 'boolean') {
    console.error('Invalid result data', record.id); errors += 1;
  }
  if (!record.provenance?.provider || !record.provenance?.providerUrl) {
    console.error('Missing provenance', record.id); errors += 1;
  }
  if (record.identity?.status === 'matched' && (!record.identity.route || !record.identity.method || !record.identity.confidence)) {
    console.error('Incomplete identity assertion', record.id); errors += 1;
  }
}

for (const year of [2018, 2022, 2026]) {
  if (!years.has(year)) { console.error(`Missing election cycle ${year}`); errors += 1; }
}

if (!EALING_CANDIDACY_HISTORY_META.generated || EALING_CANDIDACY_HISTORY_META.recordCount !== EALING_CANDIDACY_HISTORY.length) {
  console.error('Candidacy history metadata does not match generated records'); errors += 1;
}

// Regression anchors for abbreviated historical names. These are public election
// records whose current-profile identity is unambiguous and should never silently
// drop out of profile history again.
const anchors = [
  { year: 2022, sourceName: 'Donnelly S.', route: 'people/steve-donnelly', ward: 'East Acton' },
  { year: 2022, sourceName: 'Ball J.', route: 'people/jon-ball', ward: 'Ealing Common' },
  { year: 2022, sourceName: 'Driscoll P.', route: 'people/paul-driscoll', ward: 'Northfield' }
];

for (const anchor of anchors) {
  const record = EALING_CANDIDACY_HISTORY.find(item =>
    item.electionYear === anchor.year &&
    item.candidateNameSource === anchor.sourceName &&
    item.ward?.name === anchor.ward
  );
  if (!record) {
    console.error('Missing historical regression anchor', anchor); errors += 1; continue;
  }
  if (record.identity?.status !== 'matched' || record.identity?.route !== anchor.route) {
    console.error('Historical identity regression anchor failed', anchor, record.identity); errors += 1;
  }
}

if (errors) {
  console.error(`Structured candidacy history validation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log(`Validated ${EALING_CANDIDACY_HISTORY.length} structured candidacy records across ${[...years].sort().join(', ')}.`);
