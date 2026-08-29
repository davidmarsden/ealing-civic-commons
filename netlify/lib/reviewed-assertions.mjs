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

function reviewedRole({ id, from, type, note, validFrom = '2026-05-26', evidence = cabinetEvidence }) {
  return {
    id,
    from,
    to: council,
    type,
    directional: true,
    note,
    validFrom,
    validTo: null,
    evidence,
    confidence: 'high',
    reviewStatus: 'reviewed',
    provider: 'civic-commons',
    reviewedBy: 'Civic Commons',
    reviewedAt: '2026-08-29'
  };
}

export const REVIEWED_ASSERTIONS = [
  {
    id: 'commons-assertion:peter-mason-leader-of-ealing-council-2026',
    from: { id: 'civic:person:peter-mason', name: 'Peter Mason', type: 'person', route: 'people/peter-mason' },
    to: council,
    type: 'leader_of',
    directional: true,
    note: 'Ealing Council records Peter Mason as Leader of the Council. Council resolved on 26 May 2026 to elect him leader until the annual meeting after the next election in May 2030.',
    validFrom: '2026-05-26',
    validTo: '2030-05',
    evidence: ['ealing-council-cabinet-2026', 'ealing-council-leader-election-2026'],
    confidence: 'high',
    reviewStatus: 'reviewed',
    provider: 'civic-commons',
    reviewedBy: 'Civic Commons',
    reviewedAt: '2026-08-29'
  },
  reviewedRole({
    id: 'commons-assertion:louise-brett-deputy-leader-of-ealing-council-2026',
    from: { id: 'civic:person:louise-brett', name: 'Louise Brett', type: 'person', route: 'people/louise-brett' },
    type: 'deputy_leader_of',
    note: 'Ealing Council records Louise Brett as Deputy Leader of the Council.'
  }),
  reviewedRole({
    id: 'commons-assertion:louise-brett-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:louise-brett', name: 'Louise Brett', type: 'person', route: 'people/louise-brett' },
    type: 'cabinet_member_of',
    note: 'Louise Brett is Cabinet Member for Safe and Genuinely Affordable Homes, covering housing supply, allocations, homelessness, estate management and related housing responsibilities.'
  }),
  reviewedRole({
    id: 'commons-assertion:steve-donnelly-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:steve-donnelly', name: 'Steve Donnelly', type: 'person', route: 'people/steve-donnelly' },
    type: 'cabinet_member_of',
    note: 'Steve Donnelly is Cabinet Member for Inclusive Economy and Efficiency, covering budget and finance, procurement, council assets, digital services and related responsibilities.'
  }),
  reviewedRole({
    id: 'commons-assertion:monica-hamidi-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:monica-hamidi', name: 'Monica Hamidi', type: 'person', route: 'people/monica-hamidi' },
    type: 'cabinet_member_of',
    note: 'Monica Hamidi is Cabinet Member for Good Growth, covering regeneration strategy, the Local Plan, planning policy and development control.'
  }),
  reviewedRole({
    id: 'commons-assertion:dominic-moffitt-cabinet-member-ealing-council-2026',
    from: { id: 'civic:person:dominic-moffitt', name: 'Dominic Moffitt', type: 'person', route: 'people/dominic-moffitt' },
    type: 'cabinet_member_of',
    note: 'Dominic Moffitt is Cabinet Member for Climate Action, covering climate and sustainability, air quality, transport, waste, street cleansing and related environmental responsibilities.'
  }),
  ...[
    ['acton', 'Acton'],
    ['greenford', 'Greenford'],
    ['hanwell', 'Hanwell'],
    ['northolt', 'Northolt'],
    ['perivale', 'Perivale']
  ].map(([slug, name]) => ({
    id: `commons-assertion:${slug}-part-of-ealing`,
    from: { id: `civic:place:${slug}`, name, type: 'place', route: `places/${slug}` },
    to: { id: 'civic:place:ealing', name: 'Ealing', type: 'place', route: 'places/ealing' },
    type: 'part_of',
    directional: true,
    note: `${name} is one of the seven towns of the London Borough of Ealing.`,
    validFrom: null,
    validTo: null,
    evidence: townEvidence,
    confidence: 'high',
    reviewStatus: 'reviewed',
    provider: 'civic-commons',
    reviewedBy: 'Civic Commons',
    reviewedAt: '2026-08-29'
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
