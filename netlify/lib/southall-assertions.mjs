export const SOUTHALL_SOURCES = {
  'ealing-seven-towns-profile-2023': {
    id: 'commons-source:ealing-seven-towns-profile-2023',
    title: 'Ealing 7 Towns Profile — Annual Public Health Report 2023',
    publisher: 'Ealing Council',
    sourceType: 'official-report',
    url: 'https://www.ealing.gov.uk/download/downloads/id/19053/annual_public_health_report_2023_-_ealing_town_profiles_health_and_wellbeing.pdf',
    reviewedAt: '2026-09-01'
  },
  'ealing-basemaps-wards': {
    id: 'commons-source:ealing-basemaps-wards',
    title: 'Ealing BaseMaps — ward geography',
    publisher: 'Ealing Council / ArcGIS',
    sourceType: 'official-data',
    url: 'https://services1.arcgis.com/HumUw0sDQHwJuboT/ArcGIS/rest/services/Ealing_BaseMaps/FeatureServer/2',
    reviewedAt: '2026-09-01'
  }
};

const southall = { id: 'civic:place:southall', name: 'Southall', type: 'place', route: 'places/southall' };
const ealing = { id: 'civic:place:ealing', name: 'Ealing', type: 'place', route: 'places/ealing' };
const townProfileGeography = {
  id: 'civic:geography:southall-town-profile',
  name: 'Southall Town Profile geography',
  type: 'geography',
  route: null
};

function assertion({ id, from, to, type, note, evidence }) {
  return {
    id,
    from,
    to,
    type,
    directional: true,
    note,
    validFrom: null,
    validTo: null,
    evidence,
    confidence: 'high',
    reviewStatus: 'reviewed',
    provider: 'civic-commons',
    reviewedBy: 'Civic Commons',
    reviewedAt: '2026-09-01'
  };
}

export const SOUTHALL_ASSERTIONS = [
  assertion({
    id: 'commons-assertion:southall-part-of-ealing',
    from: southall,
    to: ealing,
    type: 'part_of',
    note: 'Ealing Council identifies Southall as one of the seven towns of the London Borough of Ealing.',
    evidence: ['ealing-seven-towns-profile-2023']
  }),
  assertion({
    id: 'commons-assertion:southall-town-profile-geography',
    from: southall,
    to: townProfileGeography,
    type: 'defined_by',
    note: 'For Civic Commons town-level evidence, Southall uses the six Ealing wards assigned to the Southall town geography: Dormers Wells, Lady Margaret, Norwood Green, Southall Broadway, Southall Green and Southall West. Constituency-context wards are kept separate.',
    evidence: ['ealing-basemaps-wards']
  })
];

function sourceView(id) {
  const source = SOUTHALL_SOURCES[id];
  return source ? { ...source, provider: 'civic-commons' } : null;
}

export function southallAssertionsForEntity(civicEntityId) {
  return SOUTHALL_ASSERTIONS
    .filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId))
    .map(item => {
      const outgoing = item.from.id === civicEntityId;
      const other = outgoing ? item.to : item.from;
      return {
        id: item.id,
        direction: outgoing ? 'outgoing' : 'incoming',
        type: item.type,
        other: {
          id: other.id,
          name: other.name,
          type: other.type,
          commonsRoute: other.route || null
        },
        note: item.note,
        validFrom: item.validFrom,
        validTo: item.validTo,
        confidence: item.confidence,
        evidence: item.evidence.map(sourceView).filter(Boolean),
        provider: item.provider,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt
      };
    });
}

export function southallSourcesForEntity(civicEntityId) {
  const ids = new Set(
    SOUTHALL_ASSERTIONS
      .filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId))
      .flatMap(item => item.evidence)
  );
  return [...ids].map(sourceView).filter(Boolean);
}
