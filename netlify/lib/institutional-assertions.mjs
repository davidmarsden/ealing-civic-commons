export const INSTITUTIONAL_SOURCES = {
  'wlwa-members-chair-2026': {
    id: 'commons-source:wlwa-members-chair-2026',
    title: 'West London Waste Authority welcomes new members and Chair',
    publisher: 'West London Waste Authority',
    sourceType: 'official-record',
    url: 'https://westlondonwaste.gov.uk/news/welcome-new-members-and-chair',
    reviewedAt: '2026-08-29'
  },
  'wlwa-authority-june-2026': {
    id: 'commons-source:wlwa-authority-june-2026',
    title: 'West London Waste Authority — 23 June 2026',
    publisher: 'West London Waste Authority / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://harrow.moderngov.co.uk/ieListDocuments.aspx?CId=1367&MId=66324',
    reviewedAt: '2026-08-29'
  },
  'opdc-board-current': {
    id: 'commons-source:opdc-board-current',
    title: 'OPDC Board',
    publisher: 'London City Hall',
    sourceType: 'official-directory',
    url: 'https://www.london.gov.uk/who-we-are/city-halls-partners/old-oak-and-park-royal-development-corporation-opdc/opdc-governance-board-and-committees/opdc-board',
    reviewedAt: '2026-08-29'
  },
  'opdc-disc-current': {
    id: 'commons-source:opdc-disc-current',
    title: 'OPDC Development, Investment and Sustainability Committee',
    publisher: 'London City Hall',
    sourceType: 'official-directory',
    url: 'https://www.london.gov.uk/who-we-are/city-halls-partners/old-oak-and-park-royal-development-corporation-opdc/opdc-governance-board-and-committees/opdc-development-investment-and-sustainability-committee',
    reviewedAt: '2026-08-29'
  },
  'ealing-pension-fund-panel-july-2026': {
    id: 'commons-source:ealing-pension-fund-panel-july-2026',
    title: 'Pension Fund Panel — 14 July 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-record',
    url: 'https://ealing.moderngov.co.uk/mgMeetingAttendance.aspx?ID=6838',
    reviewedAt: '2026-08-29'
  },
  'ealing-pension-fund-panel-details': {
    id: 'commons-source:ealing-pension-fund-panel-details',
    title: 'Pension Fund Panel membership',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-directory',
    url: 'https://ealing.moderngov.co.uk/mgCommitteeDetails.aspx?ID=196',
    reviewedAt: '2026-08-29'
  },
  'ealing-pension-fund-constitution': {
    id: 'commons-source:ealing-pension-fund-constitution',
    title: 'Ealing Council Constitution — Pension Fund Panel functions',
    publisher: 'Ealing Council',
    sourceType: 'official-governance-record',
    url: 'https://ealing.moderngov.co.uk/documents/g6784/Public%20reports%20pack%20Wednesday%2022-Oct-2025%20Constitution.pdf?Info=1&T=10',
    reviewedAt: '2026-08-29'
  }
};

const org = (slug, name) => ({ id: `civic:organisation:${slug}`, name, type: 'organisation', route: `organisations/${slug}` });
const person = (slug, name) => ({ id: `civic:person:${slug}`, name, type: 'person', route: `people/${slug}` });
const council = org('ealing-council', 'Ealing Council');
const wlwa = org('west-london-waste-authority', 'West London Waste Authority');
const opdc = org('old-oak-and-park-royal-development-corporation', 'Old Oak and Park Royal Development Corporation');
const opdcDisc = org('opdc-development-investment-and-sustainability-committee', 'OPDC Development, Investment and Sustainability Committee');
const pensionPanel = org('ealing-pension-fund-panel', 'Ealing Pension Fund Panel');

function assertion({ id, from, to, type, note, validFrom = null, validTo = null, evidence = [] }) {
  return { id, from, to, type, directional: true, note, validFrom, validTo, evidence, confidence: 'high', reviewStatus: 'reviewed', provider: 'civic-commons', reviewedBy: 'Civic Commons', reviewedAt: '2026-08-29' };
}

export const INSTITUTIONAL_ASSERTIONS = [
  assertion({
    id: 'commons-assertion:ealing-council-constituent-borough-of-wlwa',
    from: council,
    to: wlwa,
    type: 'constituent_borough_of',
    note: 'Ealing is one of the six constituent boroughs whose councillors make up the West London Waste Authority.',
    evidence: ['wlwa-members-chair-2026']
  }),
  assertion({
    id: 'commons-assertion:dominic-moffitt-member-of-wlwa-2026',
    from: person('dominic-moffitt', 'Dominic Moffitt'),
    to: wlwa,
    type: 'member_of',
    note: 'Dominic Moffitt is Ealing’s appointed member of the West London Waste Authority for 2026/27.',
    validFrom: '2026-06-23',
    validTo: '2027',
    evidence: ['wlwa-members-chair-2026', 'wlwa-authority-june-2026']
  }),
  assertion({
    id: 'commons-assertion:dominic-moffitt-chair-of-wlwa-2026',
    from: person('dominic-moffitt', 'Dominic Moffitt'),
    to: wlwa,
    type: 'chair_of',
    note: 'The Authority appointed Dominic Moffitt as Chair for the 2026/27 municipal year.',
    validFrom: '2026-06-23',
    validTo: '2027',
    evidence: ['wlwa-members-chair-2026', 'wlwa-authority-june-2026']
  }),
  assertion({
    id: 'commons-assertion:peter-mason-board-member-of-opdc',
    from: person('peter-mason', 'Peter Mason'),
    to: opdc,
    type: 'board_member_of',
    note: 'London City Hall lists Peter Mason, in his capacity as Leader of Ealing Council, as a current OPDC Board member.',
    evidence: ['opdc-board-current']
  }),
  assertion({
    id: 'commons-assertion:opdc-disc-committee-of-opdc',
    from: opdcDisc,
    to: opdc,
    type: 'committee_of',
    note: 'The Development, Investment and Sustainability Committee is part of OPDC’s governance structure.',
    evidence: ['opdc-disc-current']
  }),
  assertion({
    id: 'commons-assertion:peter-mason-member-of-opdc-disc',
    from: person('peter-mason', 'Peter Mason'),
    to: opdcDisc,
    type: 'member_of',
    note: 'London City Hall lists Peter Mason among the current members of the OPDC Development, Investment and Sustainability Committee.',
    evidence: ['opdc-disc-current']
  }),
  assertion({
    id: 'commons-assertion:ealing-pension-fund-panel-panel-of-ealing-council',
    from: pensionPanel,
    to: council,
    type: 'panel_of',
    note: 'The Pension Fund Panel exercises Ealing Council functions relating to administration and investment oversight of the London Borough of Ealing Pension Fund.',
    evidence: ['ealing-pension-fund-constitution', 'ealing-pension-fund-panel-details']
  }),
  assertion({
    id: 'commons-assertion:ian-kingston-chair-of-ealing-pension-fund-panel-2026',
    from: person('ian-kingston', 'Ian Kingston'),
    to: pensionPanel,
    type: 'chair_of',
    note: 'Ian Kingston is recorded as Chair of the Pension Fund Panel for 2026/27.',
    validFrom: '2026-07-14',
    validTo: '2027',
    evidence: ['ealing-pension-fund-panel-july-2026', 'ealing-pension-fund-panel-details']
  }),
  assertion({
    id: 'commons-assertion:yvonne-johnson-vice-chair-of-ealing-pension-fund-panel-2026',
    from: person('yvonne-johnson', 'Yvonne Johnson'),
    to: pensionPanel,
    type: 'vice_chair_of',
    note: 'Yvonne Johnson is recorded as Vice-Chair of the Pension Fund Panel for 2026/27.',
    validFrom: '2026-07-14',
    validTo: '2027',
    evidence: ['ealing-pension-fund-panel-july-2026', 'ealing-pension-fund-panel-details']
  })
];

function sourceView(id) { const source = INSTITUTIONAL_SOURCES[id]; return source ? { ...source, provider: 'civic-commons' } : null; }

export function institutionalAssertionsForEntity(civicEntityId) {
  return INSTITUTIONAL_ASSERTIONS.filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId)).map(item => {
    const outgoing = item.from.id === civicEntityId;
    const other = outgoing ? item.to : item.from;
    return { id: item.id, direction: outgoing ? 'outgoing' : 'incoming', type: item.type, other: { id: other.id, name: other.name, type: other.type, commonsRoute: other.route }, note: item.note || null, validFrom: item.validFrom || null, validTo: item.validTo || null, confidence: item.confidence, evidence: (item.evidence || []).map(sourceView).filter(Boolean), provider: item.provider, reviewedBy: item.reviewedBy, reviewedAt: item.reviewedAt };
  });
}

export function institutionalSourcesForEntity(civicEntityId) {
  const ids = new Set(INSTITUTIONAL_ASSERTIONS.filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId)).flatMap(item => item.evidence || []));
  return [...ids].map(sourceView).filter(Boolean);
}
