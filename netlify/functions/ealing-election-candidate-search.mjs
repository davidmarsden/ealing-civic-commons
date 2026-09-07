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

const PROFILE_NAMES = new Set(
  [...PUBLIC_PEOPLE, ...EALING_COUNCILLORS]
    .flatMap(person => [person.name, ...(person.aliases || [])])
    .map(normal)
    .filter(Boolean)
);

function matchingReferences(query) {
  const q = normal(query);
  if (q.length < 3) return [];
  const grouped = new Map();

  for (const candidacy of EALING_2026_CANDIDACIES) {
    if (!normal(candidacy.name).includes(q)) continue;
    if (PROFILE_NAMES.has(normal(candidacy.name))) continue;
    const key = normal(candidacy.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(candidacy);
  }

  return [...grouped.values()]
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
        candidacies: candidacies.map(item => ({
          ward: item.ward,
          party: item.party,
          electionDate: item.electionDate,
          electionLabel: item.electionLabel,
          elected: item.elected,
          votes: item.votes,
          url: item.sourceUrl
        })),
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
}

export default async request => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';
  return json({
    matched: true,
    references: matchingReferences(query),
    coverage: EALING_2026_CANDIDACIES_META,
    policy: 'Official election candidacy is a dated civic role. Unsuccessful candidates are searchable by name but do not receive a standalone profile solely because they stood for election.'
  });
};
