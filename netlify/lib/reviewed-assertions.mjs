export const REVIEWED_SOURCES = {
  'ealing-council-cabinet-2026': {
    id: 'commons-source:ealing-council-cabinet-2026',
    title: 'Cabinet',
    publisher: 'Ealing Council',
    sourceType: 'official-record',
    url: 'https://www.ealing.gov.uk/info/201044/councillors/567/cabinet',
    reviewedAt: '2026-08-29'
  },
  'ealing-council-leader-election-2026': {
    id: 'commons-source:ealing-council-leader-election-2026',
    title: 'Council meeting — Election of Leader, 26 May 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/ieListDocuments.aspx?CId=138&MId=6815',
    reviewedAt: '2026-08-29'
  },
  'ealing-council-cabinet-appointments-2026-27': {
    id: 'commons-source:ealing-council-cabinet-appointments-2026-27',
    title: 'Appointment of Leader & Cabinet Members 2026/27',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-record',
    url: 'https://ealing.moderngov.co.uk/documents/s25628/Appendix%201%20Cabinet%20Opposition%2026-27.pdf',
    reviewedAt: '2026-08-29'
  },
  'ealing-overview-scrutiny-july-2026': {
    id: 'commons-source:ealing-overview-scrutiny-july-2026',
    title: 'Overview and Scrutiny Committee — 23 July 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/ieListDocuments.aspx?CId=139&MId=6836&Ver=4',
    reviewedAt: '2026-08-29'
  },
  'ealing-housing-environment-scrutiny-july-2026': {
    id: 'commons-source:ealing-housing-environment-scrutiny-july-2026',
    title: 'Housing and Environment Scrutiny Panel — 16 July 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/ieListDocuments.aspx?MId=6949',
    reviewedAt: '2026-08-29'
  },
  'ealing-economy-sustainability-scrutiny-july-2026': {
    id: 'commons-source:ealing-economy-sustainability-scrutiny-july-2026',
    title: 'Economy and Sustainability Scrutiny Panel — 9 July 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/ieListDocuments.aspx?CId=401&MId=6833',
    reviewedAt: '2026-08-29'
  },
  'ealing-planning-committee-june-2026': {
    id: 'commons-source:ealing-planning-committee-june-2026',
    title: 'Planning Committee — 17 June 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/ieListDocuments.aspx?MId=6824',
    reviewedAt: '2026-08-29'
  },
  'ealing-seven-towns-profile-2023': {
    id: 'commons-source:ealing-seven-towns-profile-2023',
    title: 'Ealing 7 Towns Profile — Annual Public Health Report 2023',
    publisher: 'Ealing Council',
    sourceType: 'official-report',
    url: 'https://www.ealing.gov.uk/download/downloads/id/19053/annual_public_health_report_2023_-_ealing_town_profiles_health_and_wellbeing.pdf',
    reviewedAt: '2026-08-29'
  }
};

const council = { id: 'civic:organisation:ealing-council', name: 'Ealing Council', type: 'organisation', route: 'organisations/ealing-council' };
const cabinetEvidence = ['ealing-council-cabinet-2026', 'ealing-council-cabinet-appointments-2026-27'];
const townEvidence = ['ealing-seven-towns-profile-2023'];

function reviewedAssertion({ id, from, to, type, note, validFrom = null, validTo = null, evidence = [] }) {
  return {
    id,
    from,
    to,
    type,
    directional: true,
    note,
    validFrom,
    validTo,
    evidence,
    confidence: 'high',
    reviewStatus: 'reviewed',
    provider: 'civic-commons',
    reviewedBy: 'Civic Commons',
    reviewedAt: '2026-08-29'
  };
}

function currentCouncilRole({ id, from, type, note, evidence = cabinetEvidence, validTo = null }) {
  return reviewedAssertion({ id, from, to: council, type, note, validFrom: '2026-05-26', validTo, evidence });
}

const overviewScrutiny = { id: 'civic:organisation:overview-and-scrutiny-committee', name: 'Overview and Scrutiny Committee', type: 'organisation', route: 'organisations/overview-and-scrutiny-committee' };
const housingScrutiny = { id: 'civic:organisation:housing-and-environment-scrutiny-panel', name: 'Housing and Environment Scrutiny Panel', type: 'organisation', route: 'organisations/housing-and-environment-scrutiny-panel' };
const economyScrutiny = { id: 'civic:organisation:economy-and-sustainability-scrutiny-panel', name: 'Economy and Sustainability Scrutiny Panel', type: 'organisation', route: 'organisations/economy-and-sustainability-scrutiny-panel' };
const planningCommittee = { id: 'civic:organisation:planning-committee', name: 'Planning Committee', type: 'organisation', route: 'organisations/planning-committee' };

export const REVIEWED_ASSERTIONS = [
  reviewedAssertion({
    id: 'commons-assertion:peter-mason-leader-of-ealing-council-2026',
    from: { id: 'civic:person:peter-mason', name: 'Peter Mason', type: 'person', route: 'people/peter-mason' },
    to: council,
    type: 'leader_of',
    note: 'Ealing Council records Peter Mason as Leader of the Council. Council resolved on 26 May 2026 to elect him leader until the annual meeting after the next election in May 2030.',
    validFrom: '2026-05-26',
    validTo: '2030-05',
    evidence: ['ealing-council-cabinet-2026', 'ealing-council-leader-election-2026']
  }),
  currentCouncilRole({
    id: 'commons-assertion:louise-brett-deputy-leader-of-ealing-council-2026',
    from: { id: 'civic:person:louise-brett', name: 'Louise Brett', type: 'person', route: 'people/louise-brett' },
    type: 'deputy_leader_of',
    note: 'Ealing Council records Louise Brett as Deputy Leader of the Council.'
  }),
  currentCouncilRole({
    id: 'commons-assertion:louise-brett-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:louise-brett', name: 'Louise Brett', type: 'person', route: 'people/louise-brett' },
    type: 'cabinet_member_of',
    note: 'Louise Brett is Cabinet Member for Safe and Genuinely Affordable Homes, covering housing supply, allocations, homelessness, estate management and related housing responsibilities.'
  }),
  currentCouncilRole({
    id: 'commons-assertion:steve-donnelly-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:steve-donnelly', name: 'Steve Donnelly', type: 'person', route: 'people/steve-donnelly' },
    type: 'cabinet_member_of',
    note: 'Steve Donnelly is Cabinet Member for Inclusive Economy and Efficiency, covering budget and finance, procurement, council assets, digital services and related responsibilities.'
  }),
  currentCouncilRole({
    id: 'commons-assertion:monica-hamidi-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:monica-hamidi', name: 'Monica Hamidi', type: 'person', route: 'people/monica-hamidi' },
    type: 'cabinet_member_of',
    note: 'Monica Hamidi is Cabinet Member for Good Growth, covering regeneration strategy, the Local Plan, planning policy and development control.'
  }),
  currentCouncilRole({
    id: 'commons-assertion:dominic-moffitt-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:dominic-moffitt', name: 'Dominic Moffitt', type: 'person', route: 'people/dominic-moffitt' },
    type: 'cabinet_member_of',
    note: 'Dominic Moffitt is Cabinet Member for Climate Action, covering climate and sustainability, air quality, transport, waste, street cleansing and related environmental responsibilities.'
  }),

  reviewedAssertion({
    id: 'commons-assertion:overview-and-scrutiny-committee-committee-of-ealing-council',
    from: overviewScrutiny,
    to: council,
    type: 'committee_of',
    note: 'The Overview and Scrutiny Committee is part of Ealing Council’s formal scrutiny structure.',
    validFrom: '2026-05-26',
    evidence: ['ealing-overview-scrutiny-july-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:anthony-kelly-chair-of-overview-scrutiny-2026',
    from: { id: 'civic:person:anthony-kelly', name: 'Anthony Kelly', type: 'person', route: 'people/anthony-kelly' },
    to: overviewScrutiny,
    type: 'chair_of',
    note: 'The committee elected Anthony Kelly as Chair for the 2026/27 municipal year.',
    validFrom: '2026-07-23',
    validTo: '2027',
    evidence: ['ealing-overview-scrutiny-july-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:gary-busuttil-vice-chair-of-overview-scrutiny-2026',
    from: { id: 'civic:person:gary-busuttil', name: 'Gary Busuttil', type: 'person', route: 'people/gary-busuttil' },
    to: overviewScrutiny,
    type: 'vice_chair_of',
    note: 'The committee appointed Gary Busuttil as Vice Chair for the 2026/27 municipal year.',
    validFrom: '2026-07-23',
    validTo: '2027',
    evidence: ['ealing-overview-scrutiny-july-2026']
  }),

  reviewedAssertion({
    id: 'commons-assertion:housing-environment-scrutiny-panel-of-ealing-council',
    from: housingScrutiny,
    to: council,
    type: 'scrutiny_panel_of',
    note: 'The Housing and Environment Scrutiny Panel is part of Ealing Council’s formal scrutiny structure.',
    validFrom: '2026-05-26',
    evidence: ['ealing-housing-environment-scrutiny-july-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:miriam-rice-chair-of-housing-environment-scrutiny-2026',
    from: { id: 'civic:person:miriam-rice', name: 'Miriam Rice', type: 'person', route: 'people/miriam-rice' },
    to: housingScrutiny,
    type: 'chair_of',
    note: 'The panel appointed Miriam Rice as Chair for 2026/27.',
    validFrom: '2026-07-16',
    validTo: '2027',
    evidence: ['ealing-housing-environment-scrutiny-july-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:athena-zissimos-vice-chair-of-housing-environment-scrutiny-2026',
    from: { id: 'civic:person:athena-zissimos', name: 'Athena Zissimos', type: 'person', route: 'people/athena-zissimos' },
    to: housingScrutiny,
    type: 'vice_chair_of',
    note: 'The panel appointed Athena Zissimos as Vice Chair for 2026/27.',
    validFrom: '2026-07-16',
    validTo: '2027',
    evidence: ['ealing-housing-environment-scrutiny-july-2026']
  }),

  reviewedAssertion({
    id: 'commons-assertion:economy-sustainability-scrutiny-panel-of-ealing-council',
    from: economyScrutiny,
    to: council,
    type: 'scrutiny_panel_of',
    note: 'The Economy and Sustainability Scrutiny Panel is part of Ealing Council’s formal scrutiny structure.',
    validFrom: '2026-05-26',
    evidence: ['ealing-economy-sustainability-scrutiny-july-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:hitesh-tailor-chair-of-economy-sustainability-scrutiny-2026',
    from: { id: 'civic:person:hitesh-tailor', name: 'Hitesh Tailor', type: 'person', route: 'people/hitesh-tailor' },
    to: economyScrutiny,
    type: 'chair_of',
    note: 'The panel elected Hitesh Tailor as Chair for 2026/27.',
    validFrom: '2026-07-09',
    validTo: '2027',
    evidence: ['ealing-economy-sustainability-scrutiny-july-2026']
  }),

  reviewedAssertion({
    id: 'commons-assertion:planning-committee-committee-of-ealing-council',
    from: planningCommittee,
    to: council,
    type: 'committee_of',
    note: 'The Planning Committee is an Ealing Council committee responsible for planning decisions within its remit.',
    validFrom: '2026-05-26',
    evidence: ['ealing-planning-committee-june-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:dee-martin-chair-of-planning-committee-2026',
    from: { id: 'civic:person:dee-martin', name: 'Dee Martin', type: 'person', route: 'people/dee-martin' },
    to: planningCommittee,
    type: 'chair_of',
    note: 'The Planning Committee elected Dee Martin as Chair for the 2026/27 municipal year.',
    validFrom: '2026-06-17',
    validTo: '2027',
    evidence: ['ealing-planning-committee-june-2026']
  }),
  reviewedAssertion({
    id: 'commons-assertion:katie-douglas-vice-chair-of-planning-committee-2026',
    from: { id: 'civic:person:katie-douglas', name: 'Katie Douglas', type: 'person', route: 'people/katie-douglas' },
    to: planningCommittee,
    type: 'vice_chair_of',
    note: 'The Planning Committee appointed Katie Douglas as Vice Chair for the 2026/27 municipal year.',
    validFrom: '2026-06-17',
    validTo: '2027',
    evidence: ['ealing-planning-committee-june-2026']
  }),

  ...[
    ['acton', 'Acton'],
    ['greenford', 'Greenford'],
    ['hanwell', 'Hanwell'],
    ['northolt', 'Northolt'],
    ['perivale', 'Perivale']
  ].map(([slug, name]) => reviewedAssertion({
    id: `commons-assertion:${slug}-part-of-ealing`,
    from: { id: `civic:place:${slug}`, name, type: 'place', route: `places/${slug}` },
    to: { id: 'civic:place:ealing', name: 'Ealing', type: 'place', route: 'places/ealing' },
    type: 'part_of',
    note: `${name} is one of the seven towns of the London Borough of Ealing.`,
    evidence: townEvidence
  }))
];

function sourceView(sourceId) {
  const source = REVIEWED_SOURCES[sourceId];
  return source ? { ...source, provider: 'civic-commons' } : null;
}

export function commonsAssertionsForEntity(civicEntityId) {
  return REVIEWED_ASSERTIONS.filter(assertion => assertion.reviewStatus === 'reviewed' && (assertion.from.id === civicEntityId || assertion.to.id === civicEntityId)).map(assertion => {
    const outgoing = assertion.from.id === civicEntityId;
    const other = outgoing ? assertion.to : assertion.from;
    return {
      id: assertion.id,
      direction: outgoing ? 'outgoing' : 'incoming',
      type: assertion.type,
      other: { id: other.id, name: other.name, type: other.type, commonsRoute: other.route },
      note: assertion.note || null,
      validFrom: assertion.validFrom || null,
      validTo: assertion.validTo || null,
      confidence: assertion.confidence,
      evidence: (assertion.evidence || []).map(sourceView).filter(Boolean),
      provider: assertion.provider,
      reviewedBy: assertion.reviewedBy,
      reviewedAt: assertion.reviewedAt,
      provenance: 'commons-reviewed-assertion'
    };
  });
}

export function commonsSourcesForEntity(civicEntityId) {
  const sourceIds = new Set(REVIEWED_ASSERTIONS.filter(assertion => assertion.reviewStatus === 'reviewed' && (assertion.from.id === civicEntityId || assertion.to.id === civicEntityId)).flatMap(assertion => assertion.evidence || []));
  return [...sourceIds].map(sourceView).filter(Boolean);
}
