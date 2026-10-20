// Each source's own public RSS/Atom feed, by source id, for the FollowSpec
// subscription list (/.well-known/following.opml). Always the publisher's URL,
// never a relay or bridge we read it through (ModernGov is read via a relay and
// rss2json because Cloudflare blocks cloud IPs; readers can use the original).
// Sources not listed here are watched pages without a public feed; the list
// links to their homepage.
//
// scripts/test-socialspec.mjs fails if a feed URL in an adapter is missing here.
export const PUBLIC_FEEDS = {
  'around-ealing': 'https://www.aroundealing.com/feed/',
  'clean-air-southall-hayes-youtube': 'https://www.youtube.com/feeds/videos.xml?channel_id=UChFHFUx8LL0v7u5NIwyImZQ',
  'community-powered-reporting': 'https://communitypoweredreporting.co.uk/feed/',
  'ealing-civic-society': 'https://ealingcivicsociety.org/feed/',
  'ealing-council-news': 'https://www.ealing.gov.uk/rss/news',
  'ealing-council-petitions': 'https://ealing.moderngov.co.uk/mgRss.aspx?f=2',
  'ealing-council-youtube': 'https://www.youtube.com/feeds/videos.xml?user=EalingCouncil',
  'ealing-matters': 'https://ealingmatters.org.uk/feed/',
  'ealing-news': 'https://www.ealing.news/feed/',
  'ealing-transition': 'https://ealingtransition.org.uk/feed/',
  'ealing-wildlife-group': 'https://ealingwildlifegroup.com/feed/',
  'east-acton-golf-links': 'https://eaglra.wordpress.com/feed/',
  'exposurebox-youtube': 'https://www.youtube.com/feeds/videos.xml?user=exposurebox',
  'gla-assembly-investigations': 'https://www.london.gov.uk/rss-feeds/80616',
  'gla-assembly-press-releases': 'https://www.london.gov.uk/rss-feeds/80611',
  'gla-assembly-publications': 'https://www.london.gov.uk/rss-feeds/80633',
  'gla-environment-publications': 'https://www.london.gov.uk/rss-feeds/80644',
  'gla-housing-land-publications': 'https://www.london.gov.uk/rss-feeds/80642',
  'gla-planning-publications': 'https://www.london.gov.uk/rss-feeds/80643',
  'london-assembly-youtube': 'https://www.youtube.com/feeds/videos.xml?user=LondonAssembly',
  'met-youtube-ealing': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCFVNcTitsrWH4ko_HdE9Hzw',
  'modern-gov': 'https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0',
  'my-southall': 'https://southall.substack.com/feed',
  'neighbours-paper': 'https://neighbourspaper.org/feed/',
  'positive-greenford': 'https://positivegreenford.com/feed/',
  'sgss-southall-youtube-civic': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCX6GRph5cHvjuwGK85cxMyA',
  'southall-black-sisters-youtube': 'https://www.youtube.com/feeds/videos.xml?channel_id=UCUsEWqUfUJYr9uwLtXymxVA',
  'southall-community-alliance': 'https://southallcommunityalliance.com/feed/',
  'southall-residents-alliance': 'https://southallresidentsalliance.co.uk/feed/',
  'southall-speaks': 'https://atterkalsi.substack.com/feed',
  'southall-stories': 'https://southallstories.uk/feed.xml',
  'southall-transition': 'https://southalltransition.org/feed/',
  'vicious-ealing-council': 'https://vicious-ealing-council.co.uk/feed/',
  'view-from-w5': 'https://theviewfromw5.substack.com/feed',
  'west-ealing-neighbours': 'https://www.westealingneighbours.org.uk/feed/'
};

// YouTube channels named by @handle: their feed needs the channel ID, which the
// ingest resolves and caches (lib/youtube-channels.mjs). The list uses the cached
// ID and falls back to a link to the channel when none is cached yet.
export const YOUTUBE_HANDLES = {
  'cap-the-towers-youtube': 'capthetowers6717',
  'eci-ealing-youtube': 'eci-ealing',
  'eci-southall-youtube': 'eci-southall',
  'southall-youtube': 'southall8980',
  'young-ealing-foundation-youtube': 'youngealingfoundation'
};
