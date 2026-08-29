export const POLITICAL_SOURCES = {
  'ealing-council-election-results-2026': {
    id: 'commons-source:ealing-council-election-results-2026',
    title: 'Council elections results — 7 May 2026',
    publisher: 'Ealing Council',
    sourceType: 'official-election-result',
    url: 'https://www.ealing.gov.uk/info/201276/council_elections/3595/council_elections_results_7_may_2026',
    reviewedAt: '2026-08-29'
  },
  'ealing-council-opposition-appointments-2026-27': {
    id: 'commons-source:ealing-council-opposition-appointments-2026-27',
    title: 'Cabinet and Opposition appointments 2026/27',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-record',
    url: 'https://ealing.moderngov.co.uk/documents/g6815/Public%20reports%20pack%20Tuesday%2026-May-2026%2018.00%20Council.pdf?T=10',
    reviewedAt: '2026-08-29'
  },
  'ealing-councillors-by-party-2026': {
    id: 'commons-source:ealing-councillors-by-party-2026',
    title: 'Your councillors by party',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-directory',
    url: 'https://ealing.moderngov.co.uk/mgMemberIndex.aspx?FN=PARTY&PIC=1&VW=TABLE',
    reviewedAt: '2026-08-29'
  },
  'ealing-libdem-shadow-cabinet-2026': {
    id: 'commons-source:ealing-libdem-shadow-cabinet-2026',
    title: 'Liberal Democrat opposition and shadow cabinet after the 2026 election',
    publisher: 'Ealing Liberal Democrats',
    sourceType: 'political-group-record',
    url: 'https://www.ealinglibdems.org.uk/news/article/ealing-liberal-democrats-more-than-double-their-councillors-in-the-local-elections',
    reviewedAt: '2026-08-29'
  }
};

const council = { id: 'civic:organisation:ealing-council', name: 'Ealing Council', type: 'organisation', route: 'organisations/ealing-council' };
const labourGroup = { id: 'civic:organisation:ealing-labour-group', name: 'Ealing Labour Group', type: 'organisation', route: 'organisations/ealing-labour-group' };
const libDemGroup = { id: 'civic:organisation:ealing-liberal-democrat-group', name: 'Ealing Liberal Democrat Group', type: 'organisation', route: 'organisations/ealing-liberal-democrat-group' };
const conservativeGroup = { id: 'civic:organisation:ealing-conservative-group', name: 'Ealing Conservative Group', type: 'organisation', route: 'organisations/ealing-conservative-group' };
const greenGroup = { id: 'civic:organisation:ealing-green-group', name: 'Ealing Green Group', type: 'organisation', route: 'organisations/ealing-green-group' };
const electionEvidence = ['ealing-council-election-results-2026', 'ealing-councillors-by-party-2026'];
const oppositionEvidence = ['ealing-council-opposition-appointments-2026-27', 'ealing-councillors-by-party-2026'];
const currentOppositionEvidence = ['ealing-council-opposition-appointments-2026-27', 'ealing-libdem-shadow-cabinet-2026'];

function assertion({ id, from, to, type, note, validFrom = '2026-05-26', validTo = null, evidence = oppositionEvidence }) {
  return { id, from, to, type, directional: true, note, validFrom, validTo, evidence, confidence: 'high', reviewStatus: 'reviewed', provider: 'civic-commons', reviewedBy: 'Civic Commons', reviewedAt: '2026-08-29' };
}

const person = (slug, name) => ({ id: `civic:person:${slug}`, name, type: 'person', route: `people/${slug}` });

export const POLITICAL_ASSERTIONS = [
  assertion({
    id: 'commons-assertion:ealing-labour-group-majority-group-on-ealing-council-2026',
    from: labourGroup,
    to: council,
    type: 'majority_group_on',
    note: 'Labour won 46 of the 70 seats at the May 2026 Ealing Council election and retained control of the council.',
    validFrom: '2026-05-07',
    evidence: electionEvidence
  }),
  assertion({
    id: 'commons-assertion:ealing-liberal-democrat-group-official-opposition-to-ealing-council-2026',
    from: libDemGroup,
    to: council,
    type: 'official_opposition_to',
    note: 'The Liberal Democrats won 13 seats in May 2026 and are recorded in the council’s 2026/27 appointments as the main opposition group.',
    validFrom: '2026-05-07',
    evidence: oppositionEvidence
  }),
  assertion({
    id: 'commons-assertion:ealing-conservative-group-political-group-on-ealing-council-2026',
    from: conservativeGroup,
    to: council,
    type: 'political_group_on',
    note: 'Five Conservative councillors were elected to Ealing Council in May 2026.',
    validFrom: '2026-05-07',
    evidence: electionEvidence
  }),
  assertion({
    id: 'commons-assertion:ealing-green-group-political-group-on-ealing-council-2026',
    from: greenGroup,
    to: council,
    type: 'political_group_on',
    note: 'Five Green Party councillors were elected to Ealing Council in May 2026.',
    validFrom: '2026-05-07',
    evidence: electionEvidence
  }),
  assertion({ id: 'commons-assertion:peter-mason-member-of-ealing-labour-group-2026', from: person('peter-mason','Peter Mason'), to: labourGroup, type: 'member_of', note: 'Peter Mason is a Labour councillor and leads the Labour-controlled council.', evidence: electionEvidence }),
  assertion({ id: 'commons-assertion:gary-malcolm-leader-of-opposition-2026', from: person('gary-malcolm','Gary Malcolm'), to: council, type: 'leader_of_opposition_on', note: 'The council’s 2026/27 appointments record Gary Malcolm as Leader of the Opposition.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:gary-malcolm-leader-of-ealing-libdem-group-2026', from: person('gary-malcolm','Gary Malcolm'), to: libDemGroup, type: 'leader_of', note: 'Gary Malcolm leads the Liberal Democrat opposition group on Ealing Council.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:jon-ball-shadow-planning-2026', from: person('jon-ball','Jon Ball'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Jon Ball is the opposition spokesperson for Planning, Licensing and Regeneration and also serves as opposition whip.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:jonathan-oxley-shadow-finance-2026', from: person('jonathan-oxley','Jonathan Oxley'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Jonathan Oxley is the opposition spokesperson for Finance.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:mark-sanders-shadow-accountability-2026', from: person('mark-sanders','Mark Sanders'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Mark Sanders is the opposition spokesperson for Honesty and Accountability.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:adam-keenan-shadow-childrens-services-2026', from: person('adam-keenan','Adam Keenan'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Adam Keenan is the opposition spokesperson for Children’s Services.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:andrew-steed-shadow-adult-services-2026', from: person('andrew-steed','Andrew Steed'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Andrew Steed is the opposition spokesperson for Adult Services.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:athena-zissimos-shadow-environment-crime-2026', from: person('athena-zissimos','Athena Zissimos'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Athena Zissimos is the opposition spokesperson for Environment and Crime.', evidence: currentOppositionEvidence }),
  assertion({ id: 'commons-assertion:connie-hersch-deputy-opposition-leader-2026', from: person('connie-hersch','Connie Hersch'), to: libDemGroup, type: 'deputy_leader_of', note: 'Ealing Liberal Democrats record Connie Hersch as Deputy Leader after the May 2026 election.', evidence: ['ealing-libdem-shadow-cabinet-2026'] }),
  assertion({ id: 'commons-assertion:gary-busuttil-shadow-transport-2026', from: person('gary-busuttil','Gary Busuttil'), to: libDemGroup, type: 'shadow_cabinet_member_of', note: 'Ealing Liberal Democrats record Gary Busuttil as their Transport spokesperson after the May 2026 election.', evidence: ['ealing-libdem-shadow-cabinet-2026'] })
];

function sourceView(sourceId) {
  const source = POLITICAL_SOURCES[sourceId];
  return source ? { ...source, provider: 'civic-commons' } : null;
}

export function politicalAssertionsForEntity(civicEntityId) {
  return POLITICAL_ASSERTIONS.filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId)).map(item => {
    const outgoing = item.from.id === civicEntityId;
    const other = outgoing ? item.to : item.from;
    return { id: item.id, direction: outgoing ? 'outgoing' : 'incoming', type: item.type, other: { id: other.id, name: other.name, type: other.type, commonsRoute: other.route }, note: item.note || null, validFrom: item.validFrom || null, validTo: item.validTo || null, confidence: item.confidence, evidence: (item.evidence || []).map(sourceView).filter(Boolean), provider: item.provider, reviewedBy: item.reviewedBy, reviewedAt: item.reviewedAt };
  });
}

export function politicalSourcesForEntity(civicEntityId) {
  const sourceIds = new Set(POLITICAL_ASSERTIONS.filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId)).flatMap(item => item.evidence || []));
  return [...sourceIds].map(sourceView).filter(Boolean);
}
