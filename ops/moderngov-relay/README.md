# ModernGov static-egress relay

This tiny service exists because Ealing Council's ModernGov supplier blocks automated traffic from changing serverless egress addresses but can allow-list a fixed source IP.

The production DigitalOcean Droplet has Reserved IPv4 **138.68.117.14** configured as its outbound address. The relay binds only to `127.0.0.1:8788`; Caddy exposes fixed paths through the existing HTTPS host:

- `/_relay/moderngov/rss` → raw official ModernGov publication RSS
- `/_relay/moderngov/petitions` → raw official Ealing petitions RSS
- `/_relay/moderngov/health` → relay health for both feeds

It is deliberately **not** a general-purpose proxy. The only upstream URLs compiled into `server.mjs` are:

- `https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0`
- `https://ealing.moderngov.co.uk/mgRss.aspx?f=2`

Each feed has its own cache. Successful responses are cached for five minutes. If ModernGov fails after a successful fetch, the relay may serve that feed's cached response for up to 30 minutes rather than turning a brief upstream problem into a Commons outage.

## Install or update on the Droplet

After this change is merged:

```bash
install -d -m 0755 /opt/ealing-moderngov-relay
curl -fsSL https://raw.githubusercontent.com/davidmarsden/ealing-civic-commons/main/ops/moderngov-relay/server.mjs \
  -o /opt/ealing-moderngov-relay/server.mjs
curl -fsSL https://raw.githubusercontent.com/davidmarsden/ealing-civic-commons/main/ops/moderngov-relay/ealing-moderngov-relay.service \
  -o /etc/systemd/system/ealing-moderngov-relay.service

node --check /opt/ealing-moderngov-relay/server.mjs
systemctl daemon-reload
systemctl restart ealing-moderngov-relay.service
curl -fsS http://127.0.0.1:8788/health
curl -fsS http://127.0.0.1:8788/petitions | head
```

Inside the existing `chat-dev.ealing.civiccommons.co.uk` Caddy site block, the existing wildcard relay route covers both feeds:

```caddy
handle_path /_relay/moderngov/* {
    reverse_proxy 127.0.0.1:8788
}
```

Validate before reloading Caddy if its configuration changes:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
curl -fsS https://chat-dev.ealing.civiccommons.co.uk/_relay/moderngov/health
curl -fsS https://chat-dev.ealing.civiccommons.co.uk/_relay/moderngov/rss | head
curl -fsS https://chat-dev.ealing.civiccommons.co.uk/_relay/moderngov/petitions | head
```

## Allow-list details for Ealing

- server egress IPv4: `138.68.117.14`
- destination URLs: `https://ealing.moderngov.co.uk/mgRss.aspx?XXR=0` and `https://ealing.moderngov.co.uk/mgRss.aspx?f=2`
- destination port: `443`

## Civic Commons behaviour

`netlify/functions/moderngov-whatsnew.mjs` continues to use the publication relay for agendas, minutes and decisions. The petitions endpoint is deliberately separate so Civic Commons can represent **Ealing Council — Petitions** as a distinct official source and evolve petition-specific lifecycle metadata without conflating petitions with ordinary ModernGov publication events.

The publication relay URL can be overridden with `MODERNGOV_RELAY_URL`; otherwise the current HTTPS path above is used.
