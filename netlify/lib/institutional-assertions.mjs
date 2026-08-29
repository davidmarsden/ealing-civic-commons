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
  'ealing-safer-neighbourhood-board-current': {
    id: 'commons-source:ealing-safer-neighbourhood-board-current',
    title: 'Ealing Safer Neighbourhood Board — current membership',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-directory',
    url: 'https://ealing.moderngov.co.uk/mgCommitteeMailingList.aspx?ID=188',
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
  },
  'ealing-pension-fund-march-2026': {
    id: 'commons-source:ealing-pension-fund-march-2026',
    title: 'Pension Fund performance update — 24 March 2026',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/mgAi.aspx?ID=7829',
    reviewedAt: '2026-08-29'
  },
  'ealing-audit-london-civ-2026': {
    id: 'commons-source:ealing-audit-london-civ-2026',
    title: 'Audit Strategy Memorandum 2025/26 — London CIV migration discussion',
    publisher: 'Ealing Council / ModernGov',
    sourceType: 'official-minutes',
    url: 'https://ealing.moderngov.co.uk/mgAi.aspx?ID=8376',
    reviewedAt: '2026-08-29'
  },
  'london-civ-partner-funds-current': {
    id: 'commons-source:london-civ-partner-funds-current',
    title: 'Our Partner Funds',
    publisher: 'London CIV',
    sourceType: 'official-directory',
    url: 'https://londonciv.org.uk/Our-Partner-Funds',
    reviewedAt: '2026-08-29'
  },
  'london-civ-about-current': {
    id: 'commons-source:london-civ-about-current',
    title: 'About London CIV',
    publisher: 'London CIV',
    sourceType: 'official-record',
    url: 'https://londonciv.org.uk/about',
    reviewedAt: '2026-08-29'
  },
  'london-councils-who-we-are-current': {
    id: 'commons-source:london-councils-who-we-are-current',
    title: 'Who we are',
    publisher: 'London Councils',
    sourceType: 'official-record',
    url: 'https://www.londoncouncils.gov.uk/who-we-are',
    reviewedAt: '2026-08-29'
  },
  'london-councils-leaders-current': {
    id: 'commons-source:london-councils-leaders-current',
    title: "Leaders' committee members",
    publisher: 'London Councils',
    sourceType: 'official-directory',
    url: 'https://www.londoncouncils.gov.uk/who-we-are/leadership-and-committees/our-leadership/leaders-committee-members',
    reviewedAt: '2026-08-29'
  }
};

const org = (slug, name) => ({ id: `civic:organisation:${slug}`, name, type: 'organisation', route: `organisations/${slug}` });
const person = (slug, name) => ({ id: `civic:person:${slug}`, name, type: 'person', route: `people/${slug}` });
const council = org('ealing-council', 'Ealing Council');
const wlwa = org('west-london-waste-authority', 'West London Waste Authority');
const esnb = org('ealing-safer-neighbourhood-board', 'Ealing Safer Neighbourhood Board');
const opdc = org('old-oak-and-park-royal-development-corporation', 'Old Oak and Park Royal Development Corporation');
const opdcDisc = org('opdc-development-investment-and-sustainability-committee', 'OPDC Development, Investment and Sustainability Committee');
const pensionPanel = org('ealing-pension-fund-panel', 'Ealing Pension Fund Panel');
const pensionFund = org('ealing-pension-fund', 'London Borough of Ealing Pension Fund');
const londonCiv = org('london-civ', 'London CIV');
const londonCouncils = org('london-councils', 'London Councils');
const leadersCommittee = org('london-councils-leaders-committee', "London Councils Leaders' Committee");

function assertion({ id, from, to, type, note, validFrom = null, validTo = null, evidence = [] }) {
  return { id, from, to, type, directional: true, note, validFrom, validTo, evidence, confidence: 'high', reviewStatus: 'reviewed', provider: 'civic-commons', reviewedBy: 'Civic Commons', reviewedAt: '2026-08-29' };
}

export const INSTITUTIONAL_ASSERTIONS = [
  assertion({ id: 'commons-assertion:ealing-council-constituent-borough-of-wlwa', from: council, to: wlwa, type: 'constituent_borough_of', note: 'Ealing is one of the six constituent boroughs whose councillors make up the West London Waste Authority.', evidence: ['wlwa-members-chair-2026'] }),
  assertion({ id: 'commons-assertion:dominic-moffitt-member-of-wlwa-2026', from: person('dominic-moffitt', 'Dominic Moffitt'), to: wlwa, type: 'member_of', note: 'Dominic Moffitt is Ealing’s appointed member of the West London Waste Authority for 2026/27.', validFrom: '2026-06-23', validTo: '2027', evidence: ['wlwa-members-chair-2026', 'wlwa-authority-june-2026'] }),
  assertion({ id: 'commons-assertion:dominic-moffitt-chair-of-wlwa-2026', from: person('dominic-moffitt', 'Dominic Moffitt'), to: wlwa, type: 'chair_of', note: 'The Authority appointed Dominic Moffitt as Chair for the 2026/27 municipal year.', validFrom: '2026-06-23', validTo: '2027', evidence: ['wlwa-members-chair-2026', 'wlwa-authority-june-2026'] }),
  assertion({ id: 'commons-assertion:jags-sanghera-member-of-esnb-current', from: person('jags-sanghera', 'Jags Sanghera'), to: esnb, type: 'member_of', note: 'Ealing Council’s current ModernGov directory lists Jags Sanghera as a member of the Ealing Safer Neighbourhood Board.', evidence: ['ealing-safer-neighbourhood-board-current'] }),
  assertion({ id: 'commons-assertion:peter-mason-board-member-of-opdc', from: person('peter-mason', 'Peter Mason'), to: opdc, type: 'board_member_of', note: 'London City Hall lists Peter Mason, in his capacity as Leader of Ealing Council, as a current OPDC Board member.', evidence: ['opdc-board-current'] }),
  assertion({ id: 'commons-assertion:opdc-disc-committee-of-opdc', from: opdcDisc, to: opdc, type: 'committee_of', note: 'The Development, Investment and Sustainability Committee is part of OPDC’s governance structure.', evidence: ['opdc-disc-current'] }),
  assertion({ id: 'commons-assertion:peter-mason-member-of-opdc-disc', from: person('peter-mason', 'Peter Mason'), to: opdcDisc, type: 'member_of', note: 'London City Hall lists Peter Mason among the current members of the OPDC Development, Investment and Sustainability Committee.', evidence: ['opdc-disc-current'] }),
  assertion({ id: 'commons-assertion:ealing-pension-fund-panel-panel-of-ealing-council', from: pensionPanel, to: council, type: 'panel_of', note: 'The Pension Fund Panel exercises Ealing Council functions relating to administration and investment oversight of the London Borough of Ealing Pension Fund.', evidence: ['ealing-pension-fund-constitution', 'ealing-pension-fund-panel-details'] }),
  assertion({ id: 'commons-assertion:ealing-pension-fund-panel-oversees-ealing-pension-fund', from: pensionPanel, to: pensionFund, type: 'oversees', note: 'The Pension Fund Panel is the council body responsible for oversight of the London Borough of Ealing Pension Fund.', evidence: ['ealing-pension-fund-constitution'] }),
  assertion({ id: 'commons-assertion:ian-kingston-chair-of-ealing-pension-fund-panel-2026', from: person('ian-kingston', 'Ian Kingston'), to: pensionPanel, type: 'chair_of', note: 'Ian Kingston is recorded as Chair of the Pension Fund Panel for 2026/27.', validFrom: '2026-07-14', validTo: '2027', evidence: ['ealing-pension-fund-panel-july-2026', 'ealing-pension-fund-panel-details'] }),
  assertion({ id: 'commons-assertion:yvonne-johnson-vice-chair-of-ealing-pension-fund-panel-2026', from: person('yvonne-johnson', 'Yvonne Johnson'), to: pensionPanel, type: 'vice_chair_of', note: 'Yvonne Johnson is recorded as Vice-Chair of the Pension Fund Panel for 2026/27.', validFrom: '2026-07-14', validTo: '2027', evidence: ['ealing-pension-fund-panel-july-2026', 'ealing-pension-fund-panel-details'] }),

  assertion({ id: 'commons-assertion:ealing-pension-fund-partner-fund-of-london-civ', from: pensionFund, to: londonCiv, type: 'partner_fund_of', note: 'Ealing’s Local Government Pension Scheme fund participates in the London CIV pooling arrangements. Current Ealing records describe the Fund’s migration to London CIV and London CIV describes London local-authority pension funds as its Partner Funds.', evidence: ['ealing-pension-fund-march-2026', 'ealing-audit-london-civ-2026', 'london-civ-partner-funds-current'] }),
  assertion({ id: 'commons-assertion:london-civ-manages-investments-for-ealing-pension-fund', from: londonCiv, to: pensionFund, type: 'manages_investments_for', note: 'London CIV provides pooled investment management for its LGPS Partner Funds; Ealing Council’s 2026 records describe London CIV as taking the fund-manager role as Ealing assets migrate into the pool.', evidence: ['london-civ-about-current', 'ealing-audit-london-civ-2026'] }),

  assertion({ id: 'commons-assertion:ealing-council-member-of-london-councils', from: council, to: londonCouncils, type: 'member_of', note: 'Ealing Council is one of the 32 London boroughs that make up London Councils, the collective of London local government.', evidence: ['london-councils-who-we-are-current'] }),
  assertion({ id: 'commons-assertion:london-councils-leaders-committee-of-london-councils', from: leadersCommittee, to: londonCouncils, type: 'committee_of', note: 'The Leaders’ Committee is London Councils’ main decision-making committee and is made up of borough leaders or directly elected mayors.', evidence: ['london-councils-leaders-current'] }),
  assertion({ id: 'commons-assertion:peter-mason-member-of-london-councils-leaders-committee-2026', from: person('peter-mason', 'Peter Mason'), to: leadersCommittee, type: 'member_of', note: 'London Councils currently lists Peter Mason as Ealing’s member of the Leaders’ Committee in his role as council leader.', validFrom: '2026-05-26', evidence: ['london-councils-leaders-current'] })
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
