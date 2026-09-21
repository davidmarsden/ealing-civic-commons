# ModernGov static-egress relay

This tiny service exists because Ealing Council's ModernGov supplier blocks automated traffic from changing serverless egress addresses but can allow-list a fixed source IP.

The production DigitalOcean Droplet has Reserved IPv4 **138.68.117.14** configured as its outbound address. The relay binds only to `127.0.0.1:8788`; Caddy exposes two fixed paths through the existing HTTPS host:

- `/_relay/moderngov/rss` → raw official ModernGov RSS
- `/_relay/moderngov/health` → relay health

It is deliberately **not** a general-purpose proxy. The upstream URL is compiled into `server.mjs` as:

`https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0`

The feed is cached for five minutes. If ModernGov fails after a successful fetch, the relay may serve a cached response for up to 30 minutes rather than turning a brief upstream problem into a Commons outage.

## Install on the Droplet

After this change is merged:

```bash
install -d -m 0755 /opt/ealing-moderngov-relay
curl -fsSL https://raw.githubusercontent.com/davidmarsden/ealing-civic-commons/main/ops/moderngov-relay/server.mjs \
  -o /opt/ealing-moderngov-relay/server.mjs
curl -fsSL https://raw.githubusercontent.com/davidmarsden/ealing-civic-commons/main/ops/moderngov-relay/ealing-moderngov-relay.service \
  -o /etc/systemd/system/ealing-moderngov-relay.service

node --check /opt/ealing-moderngov-relay/server.mjs
systemctl daemon-reload
systemctl enable --now ealing-moderngov-relay.service
curl -fsS http://127.0.0.1:8788/health
```

Before changing Caddy, inspect `/etc/caddy/Caddyfile`. Inside the existing
`chat-dev.ealing.civiccommons.co.uk` site block, add this route **before the catch-all reverse proxy**:

```caddy
handle_path /_relay/moderngov/* {
    reverse_proxy 127.0.0.1:8788
}
```

If the existing site uses a catch-all `handle`, keep that after the relay block. Validate before reloading:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
curl -fsS https://chat-dev.ealing.civiccommons.co.uk/_relay/moderngov/health
curl -fsS https://chat-dev.ealing.civiccommons.co.uk/_relay/moderngov/rss | head
```

## Allow-list details for Ealing

- server egress IPv4: `138.68.117.14`
- destination URL: `https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0`
- destination port: `443`

## Civic Commons behaviour

`netlify/functions/moderngov-whatsnew.mjs` prefers the static-egress relay. It then falls back to the existing public RSS-reader bridge and finally the official What's New HTML page.

The relay URL can be overridden with `MODERNGOV_RELAY_URL`; otherwise the current HTTPS path above is used.
