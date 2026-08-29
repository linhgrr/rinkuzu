# Billing webhook and key-rotation runbook

The provider's delivery endpoint is `POST /api/billing/webhooks/{provider}`. It is
unauthenticated by necessity: anyone on the internet can post to it, and the only
thing separating a real payment notice from a forgery is the HMAC checksum.

Two consequences shape everything below. First, **every request leaves a row
behind** — accepted, ignored, unreadable or unauthenticated alike. A webhook that
is silently dropped is indistinguishable from one that never arrived, which is
exactly the situation an operator is in after a one-sided key rotation: money
stops moving and nothing anywhere records why. Second, **the body is
attacker-controlled text**, so retention is a security decision before it is an
operational one.

## Verification classes

Classification happens before anything is written. Each delivery lands in exactly
one class, and the class decides the HTTP answer, what is stored, and for how
long.

| Class                | Meaning                                                                   | Body retained | Row kept                         | HTTP        |
| -------------------- | ------------------------------------------------------------------------- | ------------- | -------------------------------- | ----------- |
| `accepted`           | Signature valid, schema understood, successful payment                    | never         | indefinitely (accounting record) | 200         |
| `ignored`            | Signature valid, schema understood, not a payment (cancellation, failure) | never         | 90 days                          | 200         |
| `unsupported_schema` | Signature valid, schema **not** understood                                | encrypted     | 1–90 days, default 30            | 200         |
| `unauthenticated`    | Signature absent, invalid, or unverifiable                                | never         | 30 days                          | 400/413/500 |

`unsupported_schema` is the only class whose body is kept, and it is kept
encrypted. It is the one class that is both provider-attested and evidence of a
bug in our own parser — the thing needed to fix it. Everything else is reduced to
a SHA-256 hash, a byte size, and a reason.

Rejections are answered with the status their reason earns, never a blanket 200,
so the provider's own delivery dashboard shows the failure too:

| Reason                    | Status | Error code                  |
| ------------------------- | ------ | --------------------------- |
| `payload_too_large`       | 413    | `validation_error`          |
| `malformed_json`          | 400    | `validation_error`          |
| `invalid_envelope`        | 400    | `validation_error`          |
| `invalid_signature`       | 400    | `invalid_webhook_signature` |
| `provider_not_configured` | 500    | `configuration_error`       |

Two requests are refused before the body is read and therefore leave no row: one
whose declared `content-length` exceeds the 64 KiB ceiling, and one from a source
that has spent its unauthenticated budget (answered `429`). Persisting either
would hand an anonymous caller exactly the write amplification those limits exist
to deny, so the rate limiter's own counters are the record that they happened.
Every other request the endpoint reads is written down.

`provider_not_configured` is deliberately a 500. A missing checksum key is our
misconfiguration; blaming the caller with a 400 would make the provider give up
retrying on a fault we can fix.

### Envelope tolerance

An envelope may gain fields without being rejected — the provider is free to add
to its payload. What may never be relaxed is the signature check or the typed
read of the fields we act on. A payload that verifies but whose money fields we
cannot read is `unsupported_schema`, never a best-effort parse: guessing at an
amount is worse than recording that we could not read one.

## Retained bodies

A retained body is sealed with AES-256-GCM under a key derived per row (HKDF-SHA256,
with the random IV doubling as the salt), so two rows never share an encryption
key and a leaked derived key exposes exactly one row. The configured key is named
by `keyVersion` rather than embedded.

Read them at **`/admin/billing` → webhook diagnostics**, or
`GET /api/admin/billing/webhooks?verificationClass=unsupported_schema`. A row whose
sealing key is no longer configured comes back with `retainedPayloadUnreadable:
true` rather than an error — an ordinary outcome after a rotation, not a fault.

Rows expire on their own through a partial TTL index on `retainUntil`
(`paymentwebhookinboxes.retention`). Accounting rows carry no `retainUntil`, so
the partial filter leaves them alone. There is no manual purge step and none
should be added: a retention window enforced by a person is a retention window
that lapses.

## Replay

Deduplication is on `dedupKey`, so re-delivering the same event is free — it
never double-applies money. Replay a dead-lettered row by clearing its lease and
next-attempt time so the next drain picks it up; do not craft a synthetic request
to the public endpoint, which would bypass the dedup key that makes replay safe.

## Health counters and what to do about them

`/admin/billing` shows one tile per counter. A non-zero tile is a queue, not an
alarm bell in itself; the actions below are what empties each one.

| Counter                         | What it means                                           | Action                                                                                    |
| ------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ordersNeedingAttention`        | Nothing else will resolve these                         | Work the order list; each row states its own reason                                       |
| `paidButUnfulfilled`            | Money taken, Premium not granted                        | Check the scheduler is running; then the fulfillment backlog drain                        |
| `attemptsInReview`              | Provider state disagreed with ours                      | Compare the provider dashboard against the attempt; an operator decides                   |
| `attemptsIndeterminate`         | Provider never confirmed whether a checkout link exists | A payable link may exist that we never recorded — reconcile by order code                 |
| `inboxOrphaned`                 | Delivery names an order we do not have yet              | Usually self-heals on retry; persistent means a lost order write                          |
| `inboxRetryable`                | Transient processing failures, still retrying           | Watch; escalate if it does not drain                                                      |
| `inboxDeadLettered`             | Gave up after the retry ceiling                         | Diagnose, fix, then replay                                                                |
| `webhooksUnsupportedSchema`     | Signature valid, payload we cannot parse                | **The one counter that indicts our code.** Read the retained body, fix the parser, replay |
| `webhooksUnauthenticatedRecent` | Deliveries we could not authenticate, last 24h          | Small and steady is internet noise. A sudden jump is a checksum key mismatch — see below  |

A jump in `webhooksUnauthenticatedRecent` with `accepted` falling to zero is the
signature of a one-sided key rotation. That combination is the alert worth paging
on; either counter alone is not.

## Registration verification

After any provider-side change, confirm the endpoint is registered and reachable
before assuming silence means quiet:

1. Run `npm run check:billing`. It validates the checksum key's shape, the
   payload key list and its `kid`s, refuses key material shared between
   verification and payload encryption, requires `ABUSE_SIGNAL_HASH_SECRET`
   wherever payments are enabled, and rejects a retention window outside 1–90
   days. It reports on shape and overlap, never on values.
2. Trigger a test delivery from the provider console.
3. Confirm a row appeared: `GET /api/admin/billing/webhooks?limit=5`. The newest
   row's `verificationClass` tells you which of the four things happened.
4. If nothing appeared at all, the endpoint is not registered or the URL is
   wrong — no class of failure is silent on our side.

## Changing the PayOS checksum key

`PAYOS_CHECKSUM_KEY` is one secret, copied verbatim from the PayOS dashboard.
It signs outbound requests and verifies inbound webhooks, and there is no key
list: PayOS issues a single checksum key per merchant and offers no window in
which two keys are accepted, so a versioned list here could never buy an overlap
the provider does not have. It could only add a second place for the two sides
to disagree.

A change is therefore a brief, deliberate outage rather than a rotation:

1. Change the key in the PayOS dashboard.
2. Set the new value in the deployment platform and deploy.
3. Watch `webhooksUnauthenticatedRecent`. Deliveries signed with the old key
   between steps 1 and 2 are recorded as `unauthenticated`, with their body
   hash, so nothing is lost — replay the affected orders from the Webhooks tab
   in `/admin/billing` once the new key is live.

Keep the gap as small as possible and do it outside peak hours. The endpoint is
unauthenticated by design, so the diagnostic rows are the only signal that money
has stopped flowing; they are the reason this is recoverable at all.

## Rotating the payload encryption key

`BILLING_WEBHOOK_PAYLOAD_KEYS` seals retained bodies. Unset means retain no body
at all, which is a legitimate configuration.

The first key seals; every listed key can open. So:

1. **Prepend** the new key. New rows seal under it immediately.
2. **Keep** the retired key listed until every row it sealed has aged out —
   `retainUntil` bounds that at 90 days, and at the default 30.
3. Drop the retired key only after that.

Dropping it early does not lose money or break the endpoint; it makes those rows
permanently unreadable, which costs you the evidence for whichever parser bug they
were kept to explain. `check:billing` warns when only one key is listed, because
that state means any previous key has already been dropped.

The checksum key must never appear in `BILLING_WEBHOOK_PAYLOAD_KEYS`;
`check:billing` fails that outright. Sharing key
material means a leaked payload key also forges webhooks.

## Handling secrets

Changing a key is a deploy-time configuration change. Nothing in this runbook
requires reading a live secret: `check:billing` reports on shape, uniqueness and
overlap, never on values, and no diagnostic surface prints key material. The
checksum key is issued by PayOS and copied verbatim; generate the others with a
CSPRNG (`openssl rand -base64 48`), at least 32 characters, and set them through
the deployment platform's secret store rather than a file in the repository.

## Reveal and replay

Two operator actions on a webhook row, both in the **Webhooks** tab of
`/admin/billing`, both authenticated, both written to the admin audit trail:

- **Reveal retained body** opens the one body we keep — a signature-valid payload
  the parser could not read — for a single row. Listings never carry it: a page
  that decrypts every retained body on the way past is a bulk disclosure, and it
  leaves "who has seen this?" unanswerable. The response is `no-store`.
- **Replay** gives a stalled row another run. A row that names an order goes back
  into the drain's queue and is settled from the provider's API exactly like a
  fresh delivery, so idempotency is unchanged — the money is identified by the
  provider's transaction reference. A row that names no order but retained its
  body is re-read with the _current_ parser, and if it now parses, the payment
  event it always was is recorded. Nothing replays through the public endpoint:
  that would mean re-deriving a signature we do not hold and would open a second
  unauthenticated path into settlement.

## Proactive alerts

The reconciliation scheduler evaluates the same health counters this document
lists and raises an alert for each condition that is tripped: paid-but-unfulfilled
orders, dead-lettered and unreadable webhooks, a burst of checksum failures,
attempts in review, unconfirmed checkout links and orphaned deliveries.

Each condition is raised at most once per cooldown — six hours for a critical
one, a day for a warning — through a single conditional upsert, so a standing
backlog announces itself once rather than once per tick and two schedulers racing
announce it once between them.

An alert is written to its outbox **before** delivery is attempted. If
`BILLING_ALERT_EMAIL` or `MAIL_FROM` is missing, the alert is still raised, still
deduplicated and still counted; the exact missing variable is recorded on the row
and logged by the scheduler as a delivery blocker. Detection never depends on the
channel being configured.

A refused delivery leaves the alert **in the queue**. Only a delivery a channel
accepted sets `dispatchedAt`; a refusal records `dispatchBlocker`,
`dispatchAttempts` and a `dispatchRetryAt` backoff, and the next sweep past that
instant offers the same alert again. So the operational contract is: fix the
missing variable or the mail outage, and what was waiting arrives within half an
hour — the retry ceiling — without anyone replaying anything and without waiting
for the condition to trip again. The backoff starts at a minute and doubles to
that ceiling, which is what stops a standing misconfiguration from becoming a
per-tick delivery attempt.

To see what is stuck, query the outbox rather than the logs — the row outlives
any log retention window:

```js
db.billingalerts
  .find(
    { dispatchedAt: { $exists: false } },
    {
      key: 1,
      severity: 1,
      raisedAt: 1,
      dispatchBlocker: 1,
      dispatchAttempts: 1,
      dispatchRetryAt: 1,
    },
  )
  .sort({ raisedAt: 1 });
```

A row with a high `dispatchAttempts` and an unchanging `dispatchBlocker` is a
channel that needs fixing, not an alert that needs re-raising. Raising the
condition again is not required and will not help: the re-raise only happens
once the cooldown lapses, and it clears the delivery verdict rather than
bypassing it.

## Environment isolation

`PAYOS_PROVIDER_ACCOUNT_ID` (falling back to `PAYOS_CLIENT_ID`) partitions every
unique index in the billing collections, and `providerEnvironment` is derived from
`NODE_ENV`. Test and production traffic must not share a provider account id: a
sandbox webhook could otherwise collide with a live order's unique key.
`check:billing` refuses a production deploy with payments enabled against a
database whose name marks it as test, CI, dev, staging or local.
