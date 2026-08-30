export const LONDON_ASSEMBLY_SOURCES = {
  'bassam-mahfouz-profile-current': {
    id: 'commons-source:bassam-mahfouz-profile-current',
    title: 'Bassam Mahfouz — London Assembly Member profile',
    publisher: 'London City Hall',
    sourceType: 'official-directory',
    url: 'https://www.london.gov.uk/who-we-are/what-london-assembly-does/london-assembly-members/bassam-mahfouz',
    reviewedAt: '2026-08-30'
  },
  'assembly-economy-committee-june-2026': {
    id: 'commons-source:assembly-economy-committee-june-2026',
    title: 'Economy, Culture and Skills Committee — 2 June 2026',
    publisher: 'London City Hall',
    sourceType: 'official-minutes',
    url: 'https://www.london.gov.uk/about-us/londonassembly/meetings/ieListDocuments.aspx?CId=463&MID=8072',
    reviewedAt: '2026-08-30'
  },
  'assembly-gla-oversight-may-2026': {
    id: 'commons-source:assembly-gla-oversight-may-2026',
    title: 'GLA Oversight Committee — 20 May 2026',
    publisher: 'London City Hall',
    sourceType: 'official-minutes',
    url: 'https://www.london.gov.uk/about-us/londonassembly/meetings/ieListDocuments.aspx?CId=254&MId=8098',
    reviewedAt: '2026-08-30'
  }
};

const org = (slug, name) => ({ id: `civic:organisation:${slug}`, name, type: 'organisation', route: `organisations/${slug}` });
const person = (slug, name) => ({ id: `civic:person:${slug}`, name, type: 'person', route: `people/${slug}` });

const assembly = org('london-assembly', 'London Assembly');
const economy = org('london-assembly-economy-culture-and-skills-committee', 'London Assembly Economy, Culture and Skills Committee');
const oversight = org('london-assembly-gla-oversight-committee', 'London Assembly GLA Oversight Committee');
const transport = org('london-assembly-transport-committee', 'London Assembly Transport Committee');
const environment = org('london-assembly-environment-committee', 'London Assembly Environment Committee');
const bassam = person('bassam-mahfouz', 'Bassam Mahfouz');

function assertion({ id, from, to, type, note, validFrom = null, validTo = null, evidence = [] }) {
  return { id, from, to, type, directional: true, note, validFrom, validTo, evidence, confidence: 'high', reviewStatus: 'reviewed', provider: 'civic-commons', reviewedBy: 'Civic Commons', reviewedAt: '2026-08-30' };
}

export const LONDON_ASSEMBLY_ASSERTIONS = [
  assertion({ id: 'commons-assertion:bassam-mahfouz-member-of-london-assembly', from: bassam, to: assembly, type: 'member_of', note: 'Bassam Mahfouz is the elected London Assembly Member for the Ealing and Hillingdon constituency.', validFrom: '2024-05', evidence: ['bassam-mahfouz-profile-current'] }),
  assertion({ id: 'commons-assertion:bassam-mahfouz-represents-ealing-hillingdon', from: bassam, to: assembly, type: 'represents_constituency_on', note: 'Bassam Mahfouz represents the Ealing and Hillingdon constituency on the London Assembly.', validFrom: '2024-05', evidence: ['bassam-mahfouz-profile-current'] }),
  assertion({ id: 'commons-assertion:economy-committee-committee-of-london-assembly', from: economy, to: assembly, type: 'committee_of', note: 'The Economy, Culture and Skills Committee is a London Assembly scrutiny committee.', evidence: ['assembly-economy-committee-june-2026'] }),
  assertion({ id: 'commons-assertion:gla-oversight-committee-of-london-assembly', from: oversight, to: assembly, type: 'committee_of', note: 'The GLA Oversight Committee is a London Assembly scrutiny committee.', evidence: ['assembly-gla-oversight-may-2026'] }),
  assertion({ id: 'commons-assertion:transport-committee-of-london-assembly', from: transport, to: assembly, type: 'committee_of', note: 'The Transport Committee is a London Assembly scrutiny committee.', evidence: ['bassam-mahfouz-profile-current'] }),
  assertion({ id: 'commons-assertion:environment-committee-of-london-assembly', from: environment, to: assembly, type: 'committee_of', note: 'The Environment Committee is a London Assembly scrutiny committee.', evidence: ['bassam-mahfouz-profile-current'] }),
  assertion({ id: 'commons-assertion:bassam-mahfouz-chair-of-economy-committee-2026', from: bassam, to: economy, type: 'chair_of', note: 'Bassam Mahfouz is Chair of the Economy, Culture and Skills Committee for 2026/27.', validFrom: '2026-05-11', validTo: '2027', evidence: ['bassam-mahfouz-profile-current', 'assembly-economy-committee-june-2026'] }),
  assertion({ id: 'commons-assertion:bassam-mahfouz-deputy-chair-of-gla-oversight-2026', from: bassam, to: oversight, type: 'deputy_chair_of', note: 'Bassam Mahfouz is Deputy Chair of the GLA Oversight Committee for 2026/27.', validFrom: '2026-05-11', validTo: '2027', evidence: ['bassam-mahfouz-profile-current', 'assembly-gla-oversight-may-2026'] }),
  assertion({ id: 'commons-assertion:bassam-mahfouz-member-of-transport-committee-2026', from: bassam, to: transport, type: 'member_of', note: 'Bassam Mahfouz is a member of the London Assembly Transport Committee.', evidence: ['bassam-mahfouz-profile-current'] }),
  assertion({ id: 'commons-assertion:bassam-mahfouz-member-of-environment-committee-2026', from: bassam, to: environment, type: 'member_of', note: 'Bassam Mahfouz is a member of the London Assembly Environment Committee.', evidence: ['bassam-mahfouz-profile-current'] })
];

function sourceView(id) { const source = LONDON_ASSEMBLY_SOURCES[id]; return source ? { ...source, provider: 'civic-commons' } : null; }

export function londonAssemblyAssertionsForEntity(civicEntityId) {
  return LONDON_ASSEMBLY_ASSERTIONS.filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId)).map(item => {
    const outgoing = item.from.id === civicEntityId;
    const other = outgoing ? item.to : item.from;
    return { id: item.id, direction: outgoing ? 'outgoing' : 'incoming', type: item.type, other: { id: other.id, name: other.name, type: other.type, commonsRoute: other.route }, note: item.note || null, validFrom: item.validFrom || null, validTo: item.validTo || null, confidence: item.confidence, evidence: (item.evidence || []).map(sourceView).filter(Boolean), provider: item.provider, reviewedBy: item.reviewedBy, reviewedAt: item.reviewedAt };
  });
}

export function londonAssemblySourcesForEntity(civicEntityId) {
  const ids = new Set(LONDON_ASSEMBLY_ASSERTIONS.filter(item => item.reviewStatus === 'reviewed' && (item.from.id === civicEntityId || item.to.id === civicEntityId)).flatMap(item => item.evidence || []));
  return [...ids].map(sourceView).filter(Boolean);
}
