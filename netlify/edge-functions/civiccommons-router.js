const NETWORK_HOST = 'civiccommons.co.uk';
const WWW_NETWORK_HOST = 'www.civiccommons.co.uk';

export default async (request, context) => {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();

  if (hostname === WWW_NETWORK_HOST) {
    url.hostname = NETWORK_HOST;
    return Response.redirect(url, 301);
  }

  if (hostname === NETWORK_HOST) {
    if (url.pathname === '/') {
      return new URL('/network/index.html', request.url);
    }

    if (url.pathname === '/charter' || url.pathname === '/charter/') {
      return new URL('/network/charter/index.html', request.url);
    }
  }

  return context.next();
};

export const config = {
  path: '/*',
  onError: 'bypass'
};
