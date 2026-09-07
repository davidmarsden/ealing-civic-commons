import { EALING_CANDIDACY_HISTORY, EALING_CANDIDACY_HISTORY_META } from '../lib/ealing-candidacy-history.mjs';
import { PUBLIC_PEOPLE } from '../lib/public-people.mjs';
import { EALING_COUNCILLORS } from '../lib/ealing-councillors.mjs';

const LIMIT = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

function normal(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return normal(value).split(/\s+/).filter(Boolean);
}

function fullNameSignature(value) {
  const parts = tokens(value);
  if (parts.length < 2) return null;
  return { surnameCore: parts[parts.length - 1], firstInitial: parts[0][0] };
}

function abbreviatedSurnameFirstSignature(value) {
  const parts = tokens(value);
  if (parts.length < 2) return null;
  const final = parts[parts.length - 1];
  if (final.length !== 1) return null;
  return { surnameCore: parts[parts.length - 2], firstInitial: final };
}

function recordSignature(record) {
  return record.electionYear === 2022
    ? abbreviatedSurnameFirstSignature(record.candidateNameSource)
    : fullNameSignature(record.candidateNameSource);
}

function sameSignature(a, b) {
  return Boolean(a && b && a.surnameCore === b.surnameCore && a.firstInitial === b.firstInitial);
}

const PROFILES = [...PUBLIC_PEOPLE, ...EALING_COUNCILLORS];
const PROFILE_BY_ROUTE = new Map(PROFILES.map(person => [person.route, person]));
const PROFILE_NAMES = new Set(
  PROFILES
    .flatMap(person => [person.name, ...(person.aliases || [])])
    .map(normal)
    .filter(Boolean)
);

function profileMatchesQuery(route, query) {
  const person = PROFILE_BY_ROUTE.get(route);
  if (!person) return false;
  const q = normal(query);
  return [person.name, ...(person.aliases || [])].some(value => normal(value).includes(q));
}

function recordMatchesQuery(record, query) {
  const q = normal(query);
  if (!q) return false;
  if (normal(record.candidateNameSource).includes(q)) return true;
  if (record.identity?.status === 'matched' && record.identity.route) {
    if (profileMatchesQuery(record.identity.route, query)) return true;
  }

  // 2022 uses abbreviated surname-first source names such as "Marsden D.".
  // Permit a full-name query to find that public election record by surname +
  // first initial. 2018 already uses full given-name-first names, so it should
  // be searched as recorded rather than forced through the abbreviation parser.
  if (record.electionYear === 2022) {
    return sameSignature(
      abbreviatedSurnameFirstSignature(record.candidateNameSource),
      fullNameSignature(query)
    );
  }

  return false;
}

function candidateRecord(record) {
  return {
    ward: record.ward?.name || null,
    wardSlug: record.ward?.slug || null,
    boundaryEra: record.ward?.boundaryEra || null,
    party: record.ballot?.description || null,
    ballotFidelity: record.ballot?.fidelity || null,
    electionDate: record.electionDate,
    electionYear: record.electionYear,
    electionLabel: record.electionLabel,
    elected: Boolean(record.result?.elected),
    votes: record.votes,
    url: record.provenance?.providerUrl || null,
    provenance: record.provenance || null,
    candidateNameSource: record.candidateNameSource
  };
}

function evidenceRecord(record) {
  return {
    type: 'election-record',
    title: `${record.electionLabel} — ${record.ward?.name || 'ward unavailable'}`,
    url: record.provenance?.providerUrl || null,
    date: record.electionDate,
    provider: record.provenance?.provider || null,
    upstream: record.provenance?.upstream || null
  };
}

function matchingReferences(query) {
  const q = normal(query);
  if (q.length < 3) return { references: [], profileElectionRecords: [] };

  const grouped = new Map();
  const profileGrouped = new Map();

  for (const record of EALING_CANDIDACY_HISTORY) {
    if (!recordMatchesQuery(record, query)) continue;

    if (record.identity?.status === 'matched' && record.identity.route) {
      const person = PROFILE_BY_ROUTE.get(record.identity.route);
      if (person) {
        if (!profileGrouped.has(record.identity.route)) {
          profileGrouped.set(record.identity.route, {
            route: record.identity.route,
            name: person.name,
            candidacies: []
          });
        }
        profileGrouped.get(record.identity.route).candidacies.push(candidateRecord(record));
        continue;
      }
    }

    if (PROFILE_NAMES.has(normal(record.candidateNameSource))) continue;
    const signature = recordSignature(record);
    const key = signature ? `${signature.surnameCore}:${signature.firstInitial}` : normal(record.candidateNameSource);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(record);
  }

  const references = [...grouped.values()]
    .map(records => {
      records.sort((a, b) => b.electionDate.localeCompare(a.electionDate) || String(a.ward?.name || '').localeCompare(String(b.ward?.name || '')));
      const fullNameRecord = records.find(item => item.electionYear === 2018) || records.find(item => item.electionYear === 2026) || records[0];
      const years = [...new Set(records.map(item => item.electionYear))].sort();
      return {
        id: `election-reference:${normal(fullNameRecord.candidateNameSource).replace(/[^a-z0-9]+/g, '-')}`,
        route: null,
        name: fullNameRecord.candidateNameSource,
        type: 'person',
        kind: 'reference',
        referenceKind: 'election-candidate',
        aliases: [...new Set(records.map(item => item.candidateNameSource).filter(name => normal(name) !== normal(fullNameRecord.candidateNameSource)))],
        description: null,
        publicRole: records.length === 1
          ? `Candidate for ${fullNameRecord.ward?.name || 'Ealing'} ward — ${fullNameRecord.ballot?.description || 'party/ballot description unavailable'}`
          : `${records.length} recorded Ealing Council candidacies across ${years.join(', ')}`,
        roleStatus: 'historical',
        referenceCount: records.length,
        candidacies: records.map(candidateRecord),
        evidence: records.slice(0, 5).map(evidenceRecord)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, LIMIT);

  const profileElectionRecords = [...profileGrouped.values()]
    .map(item => ({
      ...item,
      candidacies: item.candidacies.sort((a, b) => b.electionDate.localeCompare(a.electionDate) || String(a.ward || '').localeCompare(String(b.ward || '')))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { references, profileElectionRecords };
}

export default async request => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  const matches = matchingReferences(query);
  return json({
    matched: true,
    references: matches.references,
    profileElectionRecords: matches.profileElectionRecords,
    coverage: EALING_CANDIDACY_HISTORY_META,
    policy: 'Election candidacy is a dated civic role. Structured records preserve election/date, ward and boundary era, party/ballot description, votes/result and provenance. Records linked to an existing public profile are attached to that identity; other candidates remain search-only civic references unless another public role independently justifies a profile.'
  });
};
