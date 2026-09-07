const OFFICIAL_DIRECTORY = {
  label: 'Ealing Council — current councillor directory',
  url: 'https://ealing.moderngov.co.uk/mgMemberIndex.aspx?FN=PARTY',
  type: 'Official council directory'
};

// Current Ealing Council membership, checked against the official ModernGov directory.
// Format: [name, ward, party, additional public role?, route slug override?]
const ROSTER = [
  ['Munir Abbasi','Central Greenford','Labour'],
  ['Munir Ahmed','Perivale','Labour'],
  ['Shahbaz Ahmed','Southall Broadway','Labour'],
  ['Stephanie Ajayi','Greenford Broadway','Labour'],
  ['Jasbir Anand','Southall Green','Labour','Cabinet Member for Tackling Crime and Antisocial Behaviour'],
  ['Praveen Anand','Lady Margaret','Labour'],
  ['Rima Baaklini','Pitshanger','Labour'],
  ['Andrew Bailey','Northolt Mandeville','Labour'],
  ['Kanwal Kaur Bains','Dormers Wells','Labour'],
  ['Louise Brett','North Hanwell','Labour','Deputy Leader and Cabinet Member for Safe and Genuinely Affordable Homes'],
  ['Harbhajan Kaur Dheer','Greenford Broadway','Labour'],
  ['Ranjit Dheer','Dormers Wells','Labour'],
  ['Kamaljit Dhindsa','Southall Green','Labour'],
  ['Stephen Donnelly','East Acton','Labour','Cabinet Member for Inclusive Economy','steve-donnelly'],
  ['Katie Douglas','South Acton','Labour'],
  ['Paul Driscoll','Northfield','Labour','Cabinet Member for Healthy Equal Lives'],
  ['Atlyn Forde','Northolt West End','Labour'],
  ['Hodan Haili','North Acton','Labour'],
  ['Monica Hamidi','Lady Margaret','Labour','Cabinet Member for Good Growth'],
  ['Blerina Hashani','North Acton','Labour','Cabinet Member for a Fairer Start'],
  ['Yvonne Johnson','South Acton','Labour'],
  ['Shaira Karimi','Pitshanger','Labour'],
  ['Anthony Kelly','Greenford Broadway','Labour'],
  ['Ian Kingston','Northfield','Labour'],
  ['Sanjai Kohli','Central Greenford','Labour'],
  ['Bassam Mahfouz','Northolt West End','Labour'],
  ['Tariq Mahmood','Perivale','Labour'],
  ['Dee Martin','Northolt West End','Labour'],
  ['Peter Mason','Southall Green','Labour','Leader of the Council'],
  ['Dominic Moffitt','Northolt Mandeville','Labour','Cabinet Member for Climate Action'],
  ['Faduma Mohamed','Southall West','Labour','Mayor of Ealing'],
  ['Karam Mohan','Lady Margaret','Labour'],
  ['Ghulam Murtaza','Norwood Green','Labour','Deputy Mayor of Ealing'],
  ['Kim Kaur Nagpal','Southall West','Labour'],
  ['Kamaljit Kaur Nagpal','Southall Broadway','Labour','Cabinet Member for Decent Living Incomes'],
  ['Rabia Nasimi','East Acton','Labour'],
  ['Isabel Owen','Dormers Wells','Labour'],
  ['Miriam Rice','Northolt Mandeville','Labour'],
  ['Valery Ryan','Central Greenford','Labour'],
  ['Jags Sanghera','Norwood Green','Labour'],
  ['Charan Sharma','Perivale','Labour'],
  ['Hitesh Tailor','East Acton','Labour'],
  ['Lauren Wall','North Hanwell','Labour','Cabinet Member for Thriving Communities'],
  ['Ray Wall','North Hanwell','Labour'],
  ['Ben Wesson','Pitshanger','Labour'],
  ['Sinead Whelan','Northfield','Labour'],
  ['Jon Ball','Ealing Common','Liberal Democrats'],
  ['Gary Busuttil','Southfield','Liberal Democrats'],
  ['Will Francis','Walpole','Liberal Democrats'],
  ['Connie Hersch','Ealing Common','Liberal Democrats'],
  ['Adam Keenan','Ealing Broadway','Liberal Democrats'],
  ['Gary Malcolm','Southfield','Liberal Democrats'],
  ['Ksenia Maximova','Walpole','Liberal Democrats'],
  ['Matt Mellor','Walpole','Liberal Democrats'],
  ['Jonathan Oxley','Hanger Hill','Liberal Democrats'],
  ['Mark Sanders','Hanger Hill','Liberal Democrats'],
  ['Lakhbir Singh','Ealing Common','Liberal Democrats'],
  ['Andrew Steed','Southfield','Liberal Democrats'],
  ['Athena Zissimos','Hanger Hill','Liberal Democrats'],
  ['Julian Gallant','Ealing Broadway','Conservative'],
  ['Sean Hanrahan','Ealing Broadway','Conservative'],
  ['Flora MacLoughlin','North Greenford','Conservative'],
  ['Kristian Mower','North Greenford','Conservative'],
  ['Ajay Roy','North Greenford','Conservative'],
  ['Husam Alharahsheh','South Acton','Green Party'],
  ['Marijn van de Geer','North Acton','Green Party'],
  ['Natalia Kubica','Hanwell Broadway','Green Party'],
  ['Andrew Walkley','Hanwell Broadway','Green Party'],
  ['Clare Welsby','Hanwell Broadway','Green Party'],
  ['John Martin','Norwood Green','Independent']
];

function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const EALING_COUNCILLORS = ROSTER.map(([name, ward, party, additionalRole = null, slugOverride = null]) => {
  const slug = slugOverride || slugify(name);
  const publicRole = additionalRole ? `Councillor for ${ward}; ${additionalRole}` : `Councillor for ${ward}`;
  const description = additionalRole
    ? `Ealing councillor representing ${ward}. ${additionalRole}.`
    : `Ealing councillor representing ${ward}.`;
  const aliases = [`Councillor ${name}`, `Cllr ${name}`];
  if (name === 'Stephen Donnelly') aliases.push('Steve Donnelly');
  return {
    route: `people/${slug}`,
    id: `civic:person:${slug}`,
    name,
    type: 'person',
    publicRole,
    roleStatus: 'current',
    ward,
    party,
    description,
    aliases,
    website: OFFICIAL_DIRECTORY,
    providers: [{ provider: 'civic-commons', role: 'canonical-public-identity' }]
  };
});

const EXPECTED_PARTY_COUNTS = new Map([
  ['Labour', 46],
  ['Liberal Democrats', 13],
  ['Conservative', 5],
  ['Green Party', 5],
  ['Independent', 1]
]);

function validateRoster() {
  if (EALING_COUNCILLORS.length !== 70) throw new Error(`Expected 70 current Ealing councillors; got ${EALING_COUNCILLORS.length}`);
  const routes = new Set();
  const partyCounts = new Map();
  for (const councillor of EALING_COUNCILLORS) {
    if (routes.has(councillor.route)) throw new Error(`Duplicate councillor route: ${councillor.route}`);
    routes.add(councillor.route);
    partyCounts.set(councillor.party, (partyCounts.get(councillor.party) || 0) + 1);
  }
  for (const [party, expected] of EXPECTED_PARTY_COUNTS) {
    if (partyCounts.get(party) !== expected) throw new Error(`Expected ${expected} ${party} councillors; got ${partyCounts.get(party) || 0}`);
  }
}

validateRoster();

export function findEalingCouncillorByRoute(route) {
  const value = String(route || '').trim().replace(/^\/+|\/+$/g, '');
  return EALING_COUNCILLORS.find(councillor => councillor.route === value) || null;
}

export function mergeEalingCouncillor(existing, councillor) {
  if (!councillor) return existing || null;
  if (!existing) return councillor;
  return {
    ...existing,
    ...councillor,
    description: existing.description || councillor.description,
    aliases: [...new Set([...(existing.aliases || []), ...(councillor.aliases || [])])],
    providers: existing.providers?.length ? existing.providers : councillor.providers,
    website: councillor.website || existing.website
  };
}
