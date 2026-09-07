const councilLibraries = { label: 'Ealing Council — find your library', url: 'https://www.ealing.gov.uk/info/201241/find_your_library', type: 'Official council directory' };
const councilCommunityDirectory = { label: 'Ealing Council — Do Something Good', url: 'https://dosomethinggood.ealing.gov.uk/directory/', type: 'Official council community directory' };

function commonsProvider() {
  return [{ provider: 'civic-commons', role: 'canonical-public-identity' }];
}

function organisation(slug, name, description, website, aliases = [], town = null, institutionType = null) {
  return {
    route: `organisations/${slug}`,
    id: `civic:organisation:${slug}`,
    name,
    type: 'organisation',
    description,
    aliases,
    town,
    institutionType,
    website,
    providers: commonsProvider()
  };
}

function place(slug, name, description, website, aliases = [], town = null, institutionType = null) {
  return {
    route: `places/${slug}`,
    id: `civic:place:${slug}`,
    name,
    type: 'place',
    description,
    aliases,
    town,
    institutionType,
    website,
    providers: commonsProvider()
  };
}

export const CIVIC_INSTITUTIONS = [
  organisation(
    'young-ealing-foundation',
    'Young Ealing Foundation',
    'An independent Ealing charity established in 2017 that connects and supports grassroots youth organisations and works to improve opportunities and support for children and young people across the borough.',
    { label: 'Young Ealing Foundation', url: 'https://youngealingfoundation.org.uk/' },
    ['YEF'],
    null,
    'Youth and voluntary-sector infrastructure'
  ),
  organisation(
    'mael-gael',
    'Mael Gael',
    'A Southall community project based at Norwood Hall, providing a weekday day centre and activities focused on older people, loneliness and isolation, wellbeing, social connection, food growing and community support.',
    { label: 'Ealing Council — Mael Gael directory entry', url: 'https://dosomethinggood.ealing.gov.uk/community-support/mael-gael/' },
    ['Mael Gael Multicultural Project'],
    'Southall',
    'Community organisation'
  ),
  place(
    'norwood-hall',
    'Norwood Hall',
    'A community venue on Norwood Green Road in Southall used by Mael Gael and other local community activity.',
    { label: 'Ealing Council — Mael Gael at Norwood Hall', url: 'https://dosomethinggood.ealing.gov.uk/community-support/mael-gael/' },
    [],
    'Southall',
    'Community venue'
  ),
  organisation(
    'ealing-libraries',
    'Ealing Libraries',
    'The borough library network covering 13 council, community-managed and specialist library locations across Ealing.',
    councilLibraries,
    ['London Borough of Ealing Libraries'],
    null,
    'Public library service'
  ),

  place('acton-town-hall-library','Acton Town Hall Library','A public library serving Acton and one of Ealing borough’s library locations.',councilLibraries,['Acton Library'],'Acton','Library'),
  place('ealing-central-library','Ealing Central Library','The central public library in Ealing Broadway and one of the borough’s principal library locations.',councilLibraries,[],'Ealing','Library'),
  place('greenford-library','Greenford Library','A public library serving Greenford and one of Ealing borough’s library locations.',councilLibraries,[],'Greenford','Library'),
  place('hanwell-community-library','Hanwell Community Library','A community library serving Hanwell and part of Ealing’s borough library network.',councilLibraries,['Hanwell Library'],'Hanwell','Library'),
  place('jubilee-gardens-library','Jubilee Gardens Library','A public library serving Southall from the Jubilee Gardens area.',councilLibraries,[],'Southall','Library'),
  place('northfields-community-library','Northfields Community Library','A community library serving Northfields and the wider Ealing area.',councilLibraries,['Northfields Library'],'Ealing','Library'),
  place('northolt-leisure-centre-library','Northolt Leisure Centre Library','A library branch located at Northolt Leisure Centre and serving Northolt residents.',councilLibraries,['Northolt Leisure Library'],'Northolt','Library'),
  place('northolt-library','Northolt Library','A public library on Church Road serving Northolt.',councilLibraries,[],'Northolt','Library'),
  place('perivale-community-library','Perivale Community Library','A community library serving Perivale and part of Ealing’s borough library network.',councilLibraries,['Perivale Library'],'Perivale','Library'),
  place('pitshanger-library','Pitshanger Library','A public library serving Pitshanger and the wider Ealing area.',councilLibraries,[],'Ealing','Library'),
  place('southall-library-and-dominion-centre','Southall Library and Dominion Centre','A major public library and cultural/community venue in Southall, combining library services with the Dominion Centre.',councilLibraries,['Southall Library','Dominion Centre and Library'],'Southall','Library and community venue'),
  place('st-bernards-hospital-library','St Bernard’s Hospital Library','A specialist library serving staff and patients at St Bernard’s Hospital within the borough library listing.',councilLibraries,["St Bernard's Hospital Library"],'Ealing','Specialist library'),
  place('west-ealing-community-library','West Ealing Community Library','A community library serving West Ealing and part of the borough library network.',councilLibraries,['West Ealing Library'],'Ealing','Library'),

  organisation(
    'ealing-gurdwara-london-sikh-centre',
    'Ealing Gurdwara — London Sikh Centre',
    'A Sikh gurdwara and community institution at Sawyers Lawn in West Ealing, with worship, youth, education, volunteering and community programmes.',
    { label: 'Ealing Gurdwara', url: 'https://ealinggurdwara.org.uk/' },
    ['Ealing Gurdwara','London Sikh Centre'],
    'Ealing',
    'Gurdwara / faith and community institution'
  ),
  organisation(
    'acton-mosque',
    'Acton Mosque',
    'A mosque and community institution operated by Acton Muslim Welfare Association, serving Acton with worship, education, community support and other services.',
    { label: 'Acton Mosque', url: 'https://www.actonmosque.org/' },
    ['Acton Muslim Welfare Association','AMWA'],
    'Acton',
    'Mosque / faith and community institution'
  ),
  organisation(
    'west-london-islamic-centre-greenford-medina-mosque',
    'West London Islamic Centre — Greenford Medina Mosque',
    'A mosque and Islamic community institution on Greenford Road serving Greenford with worship, education and community services.',
    { label: 'West London Islamic Centre', url: 'https://www.wlicgreenfordmosque.com/' },
    ['Greenford Medina Mosque','West London Islamic Centre','WLIC'],
    'Greenford',
    'Mosque / faith and community institution'
  ),
  organisation(
    'bilal-masjid-greenford',
    'Bilal Masjid Greenford',
    'A mosque and community institution on Horsenden Lane North in Greenford, including youth activities and community programmes.',
    { label: 'Bilal Masjid Greenford', url: 'https://www.bilalmasjid.co.uk/' },
    ['Bilal Masjid Trust Greenford'],
    'Greenford',
    'Mosque / faith and community institution'
  ),
  organisation(
    'northolt-islamic-centre',
    'Northolt Islamic Centre',
    'A mosque and registered charity on Church Road in Northolt, established as a local prayer and community centre and providing education and community activity.',
    { label: 'Northolt Islamic Centre', url: 'https://www.niclondon.org/' },
    ['NIC London'],
    'Northolt',
    'Mosque / faith and community institution'
  ),
  organisation(
    'husaini-masjid-northolt',
    'Husaini Masjid — Anjuman-e-Burhani London',
    'The Northolt masjid and community centre of the Dawoodi Bohra community in London, based at the Mohammedi Park complex.',
    { label: 'Anjuman-e-Burhani London', url: 'https://www.aeblondon.co.uk/' },
    ['Husaini Masjid','Anjuman-e-Burhani (London)'],
    'Northolt',
    'Mosque / faith and community institution'
  ),
  organisation(
    'shree-jalaram-mandir-greenford',
    'Shree Jalaram Mandir & Community Centre Greenford',
    'A Hindu mandir and community centre on Oldfield Lane South in Greenford, combining worship and cultural activity with community service including food provision.',
    { label: 'Shree Jalaram Mandir Greenford', url: 'https://jalarammandir.co.uk/' },
    ['Shree Jalaram Mandir','Jalaram Mandir Greenford'],
    'Greenford',
    'Mandir / faith and community institution'
  ),
  organisation(
    'arya-samaj-london',
    'Arya Samaj London',
    'A West Ealing Hindu/Vedic religious and community institution on Argyle Road, providing worship, cultural activity and community support.',
    { label: 'Arya Samaj London', url: 'https://www.aryasamajlondon.org.uk/' },
    [],
    'Ealing',
    'Mandir / faith and community institution'
  ),
  organisation(
    'sikh-missionary-society-uk',
    'Sikh Missionary Society (UK)',
    'A Southall-based Sikh charity and resource centre on Featherstone Road, providing education, publications, classes, youth support and information about Sikh faith and culture.',
    { label: 'Sikh Missionary Society (UK)', url: 'https://www.sikhmissionarysociety.org/' },
    ['Sikh Missionary Society','SMS UK'],
    'Southall',
    'Sikh education and community institution'
  )
];

export function findCivicInstitutionByRoute(value) {
  const route = String(value || '').trim().replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '');
  return CIVIC_INSTITUTIONS.find(entity => entity.route === route) || null;
}
