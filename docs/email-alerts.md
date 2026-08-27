# Civic Commons email alerts — Social Phase B3

Email is a delivery option over the same stable follow model used by the browser Following view and personal RSS. It is not a separate ranking or recommendation system.

## User flow

1. A visitor follows one or more stories, sources, places or topics in the browser.
2. The Following panel offers account-free email alerts for that current follow set.
3. The visitor enters an email address.
4. Civic Commons sends a confirmation link. Confirmation links expire after 48 hours.
5. Only after confirmation does the subscription become active.
6. The scheduled dispatcher checks for matching updates every 15 minutes.
7. Every delivered message contains a one-click unsubscribe link.

Confirmation establishes the delivery cursor. Existing timeline items are not dumped into the subscriber's inbox; only later matching items and approved Commons contributions are delivered.

## Follow semantics

An email subscription stores a snapshot of the stable follow identifiers at signup:

- item key;
- source ID;
- canonical place label;
- canonical topic label.

Matching therefore has the same OR semantics as Following and personal RSS.

Changing browser-local follows later does **not** silently change an existing email subscription. A new alert set can be created from the new follows and the old one can be stopped from any delivered email.

## Stored data

The site-wide Netlify Blobs store `civic-commons-email-alerts` contains only the information required to deliver and stop alerts:

- email address;
- stable follow definition and human-readable labels;
- pending/active/unsubscribed status;
- timestamps and delivery cursor;
- random confirmation/unsubscribe capabilities.

There is no Civic Commons account record, password, profile, advertising ID, open-tracking pixel or click-tracking redirect.

## Delivery

`netlify/functions/email-dispatch.mjs` is a Netlify Scheduled Function running every 15 minutes. It reads active subscriptions and uses each subscription's portable personal RSS definition as the source of matching civic updates.

Approved contributions can therefore arrive by email in the same way they arrive in personal RSS: corrections, evidence/documents, related sources, local information and moderated context become new chronological updates.

The first version is intentionally a prototype-scale dispatcher. If subscription volume grows materially, dispatch should be refactored to fetch the shared civic feed once per run and fan out matching entries rather than fetching one personal RSS representation per subscription.

## Required deployment configuration

Email delivery is deliberately disabled unless both environment variables are available to Netlify Functions:

- `RESEND_API_KEY` — a Resend API key with permission to send mail;
- `EMAIL_FROM` — a verified sender, for example `Civic Commons <alerts@example.org>`.

If they are absent, the email signup endpoint returns HTTP 503 with a user-readable message and the scheduled dispatcher exits without sending.

The sender domain must be verified with the mail provider before public launch.

## Abuse controls

The signup endpoint:

- accepts POST only;
- rejects cross-site browser submissions;
- includes a honeypot field;
- validates email and follow data;
- applies the same 50-target-per-type bound as personal RSS;
- is rate-limited to five signup attempts per IP per minute;
- requires double opt-in before any civic alerts are sent.

## Relationship to RSS

RSS remains the most portable and privacy-minimal subscription mechanism because the Commons does not need to know who is reading it. Email necessarily requires the Commons to store an address, so it is presented as an optional convenience layer rather than a replacement for RSS.
