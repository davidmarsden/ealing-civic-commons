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
  'ealing-seven-towns-profile-2023': {
    id: 'commons-source:ealing-seven-towns-profile-2023',
    title: 'Ealing 7 Towns Profile — Annual Public Health Report 2023',
    publisher: 'Ealing Council',
    sourceType: 'official-report',
    url: 'https://www.ealing.gov.uk/download/downloads/id/19053/annual_public_health_report_2023_-_ealing_town_profiles_health_and_wellbeing.pdf',
    reviewedAt: '2026-08-29'
  }
};

const townEvidence = ['ealing-seven-towns-profile-2023'];

export const REVIEWED_ASSERTIONS = [
  {
    id: 'commons-assertion:peter-mason-leader-of-ealing-council-2026',
    from: { id: 'civic:person:peter-mason', name: 'Peter Mason', type: 'person', route: 'people/peter-mason' },
    to: { id: 'civic:organisation:ealing-council', name: 'Ealing Council', type: 'organisation', route: 'organisations/ealing-council' },
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
