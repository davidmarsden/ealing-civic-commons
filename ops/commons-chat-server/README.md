# Commons Chat server overlay

Commons Chat deliberately keeps Dave Winer's `rss.chat` server as its upstream rather than hiding a private, manually edited fork on the Droplet.

This directory is the reproducible overlay for the server-side changes that connect rss.chat to Ealing Civic Commons.

## Why this exists

The first Commons Chat prototype was patched directly in `/opt/rsschat/rssnetwork.js` on the production Droplet. That proved the design, but it created an obvious update risk: replacing the server with a future upstream `rss.chat` release could silently remove Civic Commons bindings and discussion discovery.

The files here turn those changes into version-controlled infrastructure.

The tested upstream baseline is recorded in `upstream-baseline.json`:

- upstream: `scripting/rss.chat`
- commit: `0a77f7b0cdb6d61291248ded69daa6b78f10860a`
- rss.chat version: `0.6.14`

## What the overlay adds

`apply-overlay.mjs` applies all server-code changes needed by the current Commons Chat integration:

1. **Commons Chat identity** in generated RSS.
2. **Civic object fields** on posts:
   - `commonsObjectUrl`
   - `commonsObjectType`
3. Persistence of those fields through `convertItem`, `addItem`, `updateItem` and `newPost`.
4. The open RSS extension:
   - namespace `https://civiccommons.co.uk/ns/commons-chat/1.0`
   - `<commons:object url="…" type="…"/>`
5. **`GET /getcommonsdiscussions?url=…`**, which returns root conversations and recursive post counts for a Civic Commons object.
6. **`/localbindcommons`**, a localhost-only maintenance route used to bind an existing post to a Civic Commons object.

The recursive discussion query deliberately uses `UNION`, not `UNION ALL`, so a malformed reply cycle cannot recurse forever. Root conversations are capped at eight per object for the discovery endpoint.

## Runtime preflight

`preflight.sh` protects the running service from a different class of failure: the code may be correct while the Node runtime or native dependencies are not.

Before rss.chat starts it:

1. verifies that the application directory, `config.json`, `package.json`, Node and npm exist;
2. parses the real production `config.json` and fails if it is malformed;
3. requires `database.flUseSqlite === true` so Commons Chat cannot silently fall through to the MySQL path;
4. checks that `better-sqlite3` can actually open an in-memory database under the **current Node runtime**;
5. leaves `node_modules` completely alone when that succeeds;
6. only when the native module cannot load, runs `npm rebuild better-sqlite3` and tests it again;
7. refuses startup if the rebuild still does not produce a loadable native module;
8. runs `node --check rssnetwork.js`.

This matters because `better-sqlite3` contains a native Node addon. A Node upgrade can leave a perfectly normal-looking `node_modules` directory whose compiled binary targets a different Node ABI. The preflight tests the thing that matters — whether the installed module works in the runtime that is about to start rss.chat — rather than rebuilding dependencies on every restart.

The companion systemd drop-in is `rsschat-preflight.conf`. The intended production installation is:

```bash
install -d -m 0755 /opt/rsschat/ops
install -m 0755 preflight.sh /opt/rsschat/ops/preflight.sh
install -d -m 0755 /etc/systemd/system/rsschat.service.d
install -m 0644 rsschat-preflight.conf /etc/systemd/system/rsschat.service.d/preflight.conf
systemctl daemon-reload
```

Test the preflight manually before restarting the service:

```bash
bash /opt/rsschat/ops/preflight.sh /opt/rsschat /opt/rsschat/config.json
```

Do not add `npm install` or an unconditional native-module rebuild to `ExecStartPre`. A normal service restart should not mutate working dependencies.

## Database migration

Existing installations need the two civic-binding columns. Run:

```bash
bash migrate-schema.sh /opt/rsschat/data/data.db
```

The migration:

- makes a timestamped SQLite online backup first, so WAL-mode commits are included even if the service is still running;
- inspects `PRAGMA table_info(items)`;
- adds only missing columns;
- can safely be run again.

Fresh databases created by the patched server include the columns in the initial `items` schema.

## Applying the overlay

Do **not** edit a newly downloaded upstream server by hand.

From this directory:

```bash
node apply-overlay.mjs /path/to/rssnetwork.js
node verify-overlay.mjs /path/to/rssnetwork.js
```

The patcher makes a timestamped `.pre-commons-overlay-…` copy before writing the modified source.

It is intentionally strict. Each edit is anchored to the upstream source we tested. If an upstream release changes one of those locations, the command stops with `Overlay anchor not found` instead of guessing how to patch the new code.

That failure is a feature: review the upstream change, update the overlay in Git, then deploy.

## Production update procedure

Current production paths:

- upstream checkout: `/opt/rss.chat`
- running service directory: `/opt/rsschat`
- server: `/opt/rsschat/rssnetwork.js`
- config: `/opt/rsschat/config.json`
- database: `/opt/rsschat/data/data.db`
- systemd service: `rsschat.service`

For an upstream update:

1. Take a DigitalOcean snapshot before touching the running service.
2. Update `/opt/rss.chat` and note the exact upstream commit.
3. Copy the upstream `server/code` directory to a **staging directory**, not over production.
4. Preserve the production `config.json`; never commit SMTP credentials or other secrets here.
5. Run the schema migration against a copy of the database if schema work is required.
6. Run `apply-overlay.mjs` against the staged `rssnetwork.js`.
7. Run `verify-overlay.mjs` against the staged file.
8. Start/test the staged server on a non-production port if the upstream release is substantial.
9. Only then replace the production server code. The systemd runtime preflight must pass before `rsschat.service` is allowed to start.
10. If Caddy configuration changed, run `caddy validate --config /etc/caddy/Caddyfile` before reloading Caddy.
11. Restart `rsschat.service`.
12. Poll for readiness rather than relying on a fixed sleep, then run the HTTP smoke tests below and inspect the service log.

A minimal on-server verification after deployment is:

```bash
node verify-overlay.mjs /opt/rsschat/rssnetwork.js \
  --url=https://chat-dev.ealing.civiccommons.co.uk
```

A simple readiness poll after a restart is:

```bash
for i in {1..30}; do
  if curl -fsS 'https://chat-dev.ealing.civiccommons.co.uk/getcommonsdiscussions?url=https%3A%2F%2Fealing.civiccommons.co.uk%2F' >/dev/null; then
    echo "Commons Chat is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Commons Chat did not become ready." >&2
    systemctl --no-pager --full status rsschat
    journalctl -u rsschat -n 80 --no-pager
    exit 1
  fi
  sleep 1
done
```


## Functional checks

The overlay verifier checks source markers and runs `node --check`. With `--url`, it also checks that `/getcommonsdiscussions` returns the expected response shape.

After a meaningful server update, also check:

```bash
curl -fsS 'https://chat-dev.ealing.civiccommons.co.uk/getcommonsdiscussions?url=https%3A%2F%2Fealing.civiccommons.co.uk%2F'
```

and inspect a bound user's RSS feed for:

```xml
xmlns:commons="https://civiccommons.co.uk/ns/commons-chat/1.0"
<commons:object url="…" type="…"/>
```

Then test the full application path:

Civic Commons item → **Start/Join conversation** → Commons Chat post → Civic Commons discussion discovery.

## Configuration belongs outside the overlay

Production configuration remains in `/opt/rsschat/config.json`. In particular:

```json
{
  "productName": "commonsChat",
  "productNameForDisplay": "Commons Chat",
  "urlServerHomePageSource": "https://ealing.civiccommons.co.uk/commons-chat/index.html"
}
```

The production favicon is the approved Ealing oak. Mail credentials and authentication secrets are deliberately not represented in this repository.

## Upstream compatibility check

The repository workflow `commons-chat-overlay-check.yml` applies the overlay to both:

- the pinned known-good upstream commit; and
- the current `scripting/rss.chat` `main` branch.

If the pinned test breaks, our overlay itself has regressed. If current upstream stops accepting the overlay, an upstream change needs review **before** Commons Chat is upgraded.

## Relationship to the web layer

This directory covers only the rss.chat server overlay.

The Civic Commons web integration remains separately versioned in:

- `public/commons-chat/`
- `netlify/functions/commons-chat-discussions.mjs`
- `netlify/functions/commons-chat-report.mjs`

That separation is intentional: the server remains an open conversation service, while Ealing Civic Commons supplies the local civic context, discovery proxy, moderation workflow and public interface.
