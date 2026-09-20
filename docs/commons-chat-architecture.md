# Commons Chat — architecture and interoperability

**Updated:** 20 September 2026  
**Status:** Live Ealing implementation

Commons Chat is the public conversation layer for Ealing Civic Commons. It is based on the open-source [RSS.chat](https://github.com/scripting/rss.chat) client/server, with a deliberately small Civic Commons integration layer.

The architectural boundary is intentional:

> **Civic Commons records what is happening. Commons Chat records what people are saying about it.**

Conversation can point at and discuss a durable civic object, but a chat post does not silently become reviewed civic knowledge. Corrections, evidence and durable context still cross the Commons review boundary before they enter the civic record.

## 1. Why RSS.chat

RSS.chat is useful here because the conversation network is made from open web primitives rather than a proprietary social graph.

Each account has an RSS 2.0 feed. Replies use open RSS/source namespace elements, including reply and comments relationships. The server also exposes a public read API and websocket firehose. This means another reader, client, bot or bridge can consume the same network without needing the Commons Chat web interface.

The Ealing implementation keeps those upstream interfaces intact rather than replacing them with a bespoke closed protocol.

## 2. Live deployment

The current Ealing stack is:

```text
Ealing Civic Commons
ealing.civiccommons.co.uk
        |
        | Discuss / Join conversation
        v
Commons Chat client shell
served from the Civic Commons repository / Netlify
        |
        v
RSS.chat server
chat-dev.ealing.civiccommons.co.uk
DigitalOcean Ubuntu + Node + SQLite
Caddy HTTPS/WSS reverse proxy
        |
        +--> public RSS feeds
        +--> HTTP API
        +--> websocket updates
        +--> Resend email sign-in
```

The server is an upstream RSS.chat deployment plus a reproducible Civic Commons overlay kept in this repository under `ops/commons-chat-server/`.

The overlay is pinned to a known upstream baseline, verified in CI and designed to fail closed when upstream source anchors no longer match. This keeps local changes reviewable rather than depending on undocumented edits on the server.

### Runtime preflight

Commons Chat now also has a systemd `ExecStartPre` safety check installed on the production Droplet.

Before every rss.chat start it:

- validates the real `config.json`;
- requires `database.flUseSqlite === true`;
- checks that `better-sqlite3` can open an in-memory database under the current Node runtime;
- leaves `node_modules` untouched when that succeeds;
- rebuilds only `better-sqlite3` if the native module cannot load, then tests it again;
- refuses startup if the rebuild still fails;
- runs `node --check` against `rssnetwork.js`.

This protects the service against a common native-module failure mode after Node upgrades: the package can still be present on disk while its compiled addon targets an older Node ABI.

The preflight is intentionally conservative. A normal restart does not run `npm install` and does not rebuild working dependencies.

The production service currently runs Node 24 with SQLite explicitly enabled. The client shell source is the canonical production URL:

```text
https://ealing.civiccommons.co.uk/commons-chat/index.html
```

## 3. Civic object binding

A Commons Chat root post can carry:

- `commonsObjectUrl` — the canonical Ealing Civic Commons URL;
- `commonsObjectType` — the civic object type.

Those values are stored with the chat item and emitted in RSS through the Civic Commons namespace:

```xml
<commons:object
  url="https://ealing.civiccommons.co.uk/items/..."
  type="item" />
```

The public `/getcommonsdiscussions` endpoint lets a Civic Commons page discover existing discussion roots for the same civic object. For each root it returns a recursive `ctPosts` count covering that root and its descendants; it does not return the descendant reply records themselves.

This gives one durable relationship in both directions:

```text
Civic item -> Discuss in Commons Chat
Commons Chat post -> Linked Civic Commons object
```

Replies do not have to duplicate the binding. They remain descendants of the bound root conversation.

## 4. Identity, privacy and sign-in

Reading is public.

Posting requires a Commons Chat account. Sign-in uses an emailed verification/sign-in link rather than a Commons Chat password. Transport between the browser and server is protected by HTTPS/WSS.

Public:
- profile/display name;
- profile description and website where supplied;
- posts, replies and public feed.

Private account data:
- sign-in email address.

The sign-in email is not displayed publicly. As with any email-link authentication system, control of the email inbox and sign-in links is security-sensitive.

## 5. Moderation boundary

Commons Chat is a public conversation service, not an unmoderated message board.

Reports are review signals, not votes. The present moderation layer records reports and human decisions without silently turning a report into deletion or restriction.

Future destructive actions such as hide, restore, restrict or suspend require an authenticated moderator role and server-side audit trail before they are exposed through a web control.

The [Community Guidelines](/community-guidelines/) apply to Commons Chat.

## 6. Micro.blog integration

Micro.blog added RSS.chat as a manual cross-posting destination in August 2026 ([Micro.blog News, 6 August 2026](https://news.micro.blog/2026/08/06/added-rsschat-as-an-option.html)).

A Micro.blog account can connect to this Commons Chat server using:

```text
chat-dev.ealing.civiccommons.co.uk
```

After email verification, a Micro.blog post can be sent to Commons Chat from **Cross-post… → RSS chat**.

This has been tested successfully against the Ealing instance. Titles, body content and images can arrive intact, and long posts use RSS.chat's normal in-place expansion in the timeline.

The publishing model remains:

```text
canonical article/blog post
        |
        +--> Micro.blog
        |
        +--> Commons Chat conversation copy
```

The original site remains canonical. Commons Chat is the conversational/social copy, not the archival source of the article.

## 7. Bluesky, Mastodon and other networks

There is an important distinction between **direct RSS.chat integration** and **bridging through another open publishing service**.

### Direct, verified today

- **Micro.blog → RSS.chat** manual cross-posting is implemented and tested on Commons Chat.
- RSS.chat itself exposes feeds, API and websocket interfaces that make other bridges technically possible.

### Through Micro.blog

Micro.blog can cross-post blog/feed sources to services including Mastodon, Bluesky, Threads, Nostr, Pixelfed, Tumblr, Medium, LinkedIn and Flickr. It also supports manual cross-posting to several of those networks.

That means Micro.blog can act as an interoperability hub around the same canonical publishing source.

Upstream RSS.chat development has also demonstrated an RSS.chat post reaching Bluesky through Micro.blog ([Scripting News, 8 August 2026](http://scripting.com/2026/08/08.html)). We should treat that as evidence that the bridge is viable, not as proof that every target behaves identically with Commons Chat.

### Not yet a Commons Chat promise

Commons Chat does **not** currently claim native two-way federation with:

- ActivityPub / Mastodon;
- AT Protocol / Bluesky;
- Nostr;
- Threads or other proprietary APIs.

Those remain bridge candidates. A future integration should preserve canonical Commons URLs and thread identity, map replies explicitly and avoid creating duplicate or ambiguous civic records.

## 8. Interoperability priorities

Near-term interoperability work should favour small, testable bridges over a federation rewrite:

1. document and test Micro.blog → Commons Chat publishing;
2. test Commons Chat RSS feed → Micro.blog source → Bluesky/Mastodon cross-posting;
3. record external syndicated-copy URLs where a platform exposes them;
4. investigate reply round-tripping without pretending separate-network replies are one thread unless identity mapping is reliable;
5. keep the RSS/API/websocket layer stable so other clients can connect directly;
6. only add native ActivityPub or AT Protocol support when it solves a demonstrated user need.

## 9. Portability rule

Commons Chat is deliberately replaceable.

Ealing Civic Commons must retain its own:

- civic object URLs;
- source provenance;
- reviewed contributions;
- follows/subscriptions;
- civic graph and relationships;
- moderation records.

If RSS.chat, Micro.blog or any external social network disappears or changes direction, the civic record must remain useful.

**Conversation is connected to the Commons. It does not own the Commons.**


## References

- [RSS.chat source repository](https://github.com/scripting/rss.chat)
- [RSS.chat HTTP API documentation](https://github.com/scripting/rss.chat/blob/main/server/docs/api.md)
- [Micro.blog: manual cross-posting](https://help.micro.blog/t/manual-cross-posting/2509)
- [Micro.blog: automatic cross-posting to Mastodon and other services](https://help.micro.blog/t/automatic-cross-posting-to-mastodon-and-other-services/860)
- [Micro.blog: Bluesky integration](https://help.micro.blog/t/bluesky-cross-posting-and-mentions/1702)
