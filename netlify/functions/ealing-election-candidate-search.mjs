import { EALING_2026_CANDIDACIES, EALING_2026_CANDIDACIES_META } from '../lib/ealing-election-candidates.mjs';
import { PUBLIC_PEOPLE } from '../lib/public-people.mjs';
import { EALING_COUNCILLORS } from '../lib/ealing-councillors.mjs';

const LIMIT = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, stale-while-revalidate=1800',
      'access-control-allow-origin': '*'
    }
  });
}

function normal(value) {
  return String(value || '').trim().toLowerCase();
}

function nameTokens(value) {
  return normal(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const PROFILE_NAMES = new Set(
  [...PUBLIC_PEOPLE, ...EALING_COUNCILLORS]
    .flatMap(person => [person.name, ...(person.aliases || [])])
    .map(normal)
    .filter(Boolean)
);

function matchingCurrentCouncillor(candidacy) {
  if (!candidacy?.elected) return null;
  const candidateTokens = nameTokens(candidacy.name);
  if (candidateTokens.length < 2) return null;
  const candidateFirst = candidateTokens[0];
  const candidateSurname = candidateTokens[candidateTokens.length - 1];

  return EALING_COUNCILLORS.find(councillor => {
    if (normal(councillor.ward) !== normal(candidacy.ward)) return false;
    return [councillor.name, ...(councillor.aliases || [])].some(value => {
      const tokens = nameTokens(value);
      if (tokens.length < 2) return false;
      return tokens[0] === candidateFirst && tokens[tokens.length - 1] === candidateSurname;
    });
  }) || null;
}

function candidateRecord(item) {
  return {
    ward: item.ward,
    party: item.party,
    electionDate: item.electionDate,
    electionLabel: item.electionLabel,
    elected: item.elected,
    votes: item.votes,
    url: item.sourceUrl
  };
}

function matchingReferences(query) {
  const q = normal(query);
  if (q.length < 3) return { references: [], profileElectionRecords: [] };
  const grouped = new Map();
  const profileGrouped = new Map();

  for (const candidacy of EALING_2026_CANDIDACIES) {
    if (!normal(candidacy.name).includes(q)) continue;

    const councillor = matchingCurrentCouncillor(candidacy);
    if (councillor) {
      if (!profileGrouped.has(councillor.route)) {
        profileGrouped.set(councillor.route, {
          route: councillor.route,
          name: councillor.name,
          candidacies: []
        });
      }
      profileGrouped.get(councillor.route).candidacies.push(candidateRecord(candidacy));
      continue;
    }

    if (PROFILE_NAMES.has(normal(candidacy.name))) continue;
    const key = normal(candidacy.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(candidacy);
  }

  const references = [...grouped.values()]
    .map(candidacies => {
      candidacies.sort((a, b) => a.electionDate.localeCompare(b.electionDate) || a.ward.localeCompare(b.ward));
      const first = candidacies[0];
      return {
        id: `election-reference:${normal(first.name).replace(/[^a-z0-9]+/g, '-')}`,
        route: null,
        name: first.name,
        type: 'person',
        kind: 'reference',
        referenceKind: 'election-candidate',
        aliases: [],
        description: null,
        publicRole: candidacies.length === 1
          ? `Candidate for ${first.ward} ward — ${first.party}`
          : `${candidacies.length} official Ealing Council candidacies in 2026`,
        roleStatus: 'historical',
        referenceCount: candidacies.length,
        candidacies: candidacies.map(candidateRecord),
        evidence: candidacies.slice(0, 3).map(item => ({
          type: 'official-election-record',
          title: `${item.electionLabel} — ${item.ward} ward`,
          url: item.sourceUrl,
          date: item.electionDate
        }))
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, LIMIT);

  const profileElectionRecords = [...profileGrouped.values()].map(item => ({
    ...item,
    candidacies: item.candidacies.sort((a, b) => a.electionDate.localeCompare(b.electionDate) || a.ward.localeCompare(b.ward))
  }));

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
    coverage: EALING_2026_CANDIDACIES_META,
    policy: 'Official election candidacy is a dated civic role. Elected candidate records are attached to the existing councillor profile; unsuccessful candidates remain search-only references unless another public role independently justifies a profile.'
  });
};
