# Deploying on Render

Render-specific setup for this repository. [DEPLOYMENT.md](DEPLOYMENT.md) covers
the shape of the system (four services, no gateway, one database per service
boundary); this file is the part that differs per host: the blueprint, the exact
settings, and what Render does not provide.

Everything here is encoded in [`render.yaml`](../render.yaml) at the repo root,
which creates all four services plus the datastores in one go. Read this before
you click, because two values are not in the file and cannot be: the Kafka
password and the frontend origins.

## What the blueprint creates

| Resource | Render type | Plan | Notes |
|---|---|---|---|
| `identity-service` | Web Service (Docker) | `0.5c-512mb` | port from `PORT`, healthcheck `/healthz`, pre-deploy `prisma migrate deploy` |
| `session-service` | Web Service (Docker) | `0.5c-512mb` | as above |
| `preference-service` | Web Service (Docker) | `0.5c-512mb` | as above |
| `fanout-service` | Web Service (Docker) | `0.5c-512mb` | Redis + Kafka, no database, no pre-deploy command |
| `identity-db`, `sessions-db`, `preferences-db` | Render Postgres | `0.1c-256mb`, PG 16 | one instance per service, `synapgrid-*` database names |
| `inclusaai-redis` | Key Value | `256mb`, `noeviction` | fanout-service only |

`presenter-assist-service` is a deferred scaffold and is not deployed.

No `region` is set, so every resource lands in Render's default (`oregon`).
Services reach each other, Postgres and Redis over Render's private network only
when they are in the **same region**, so change `region` everywhere or nowhere —
and prefer whichever region is nearest your Aiven Kafka service, because every
service holds a Kafka connection.

## Before you deploy

### 1. Kafka topics (Aiven)

Render has no managed Kafka, so this project uses the Aiven Cloud Kafka broker
your ai-services already publish to. Topics are **not** auto-created reliably
(Aiven disables auto-creation by default, and the first publish to an
auto-created topic eats a leader election). These seven exist on the current
broker; create any that a fresh environment is missing in the Aiven console —
or with `rpk`/`kafkactl` against the same credentials:

```
identity.invitation.created
session.created
session.updated
session.ended
session.participant.updated
accessibility.preference.updated      # cleanup.policy=compact
ai.transcript.segment
```

`accessibility.preference.updated` is keyed by participant id and carries the
gating decision for one participant in one session (the shape ai-services
validates). Compaction is optional now that entries are not "the current state of
a user"; enable it only if you later add durable cross-session defaults that a
consumer must be able to read from the beginning of the topic.

If your Aiven service has an IP allowlist enabled, Render's outbound addresses
have to be allowed too — Render's instance egress IPs are dynamic on standard
plans, so the simplest option is to leave the allowlist off (access is still
gated by the SASL credentials).

### 2. CA certificate

`certs/aiven-kafka-ca.pem` holds the Aiven project CA certificate and is copied
into every image by `apps/*/Dockerfile`; `KAFKA_CA_CERT` points at
`/usr/src/app/certs/aiven-kafka-ca.pem`. It is a certificate, not a credential —
safe to commit. Replace the file and redeploy if Aiven rotates it.

### 3. Secrets

Generate fresh ones; never reuse anything that has been committed or pasted into
a chat:

```bash
openssl rand -base64 48   # JWT_SECRET (identity issues, session verifies)
openssl rand -base64 48   # PARTICIPANT_TOKEN_SECRET (session issues, preference+fanout verify)
```

The blueprint uses `generateValue: true` for both, in the `backend-shared`
environment group. Values live on the group, so every service that reads them
gets the same one — which is the requirement [DEPLOYMENT.md](DEPLOYMENT.md)
states (`JWT_SECRET` identical wherever account tokens are verified;
`PARTICIPANT_TOKEN_SECRET` identical in session/preference/fanout and different
from `JWT_SECRET`). Set them by hand instead — switch the keys to `sync: false`
and paste your own — if you need to control the values or rotate them.

## Creating the environment

1. Push this branch to GitHub.
2. Render Dashboard → **New → +** → **Blueprint** → select the repository.
3. Render previews the resources and asks for the values marked `sync: false`,
   both on the `backend-shared` group:
   - `CORS_ORIGINS` — your frontend origin(s), comma-separated
     (`https://app.example.com`). Without the real origin, browsers are blocked
     even though `curl` works.
   - `KAFKA_PASSWORD` — the Aiven service password.
4. Confirm. Render creates the three Postgres instances and the Key Value
   instance and deploys all four services.

`KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_SECURITY_PROTOCOL` (`SASL_SSL`),
`KAFKA_SASL_MECHANISM` (`plain`), `KAFKA_USERNAME` (`avnadmin`) and
`KAFKA_CA_CERT` (a path inside the image) are hardcoded in that same group.
Switch any of them to `sync: false`, or point the group at another broker, if
you run more than one environment.

### Why three Postgres instances

Per ADR-0003 each service owns its own database, and a Blueprint cannot create
additional logical databases on an existing Render Postgres — one `databases:`
entry is one instance. Three `0.1c-256mb` instances is therefore the automatable
shape; `pnpm dev` locally still uses one compose instance with three logical
databases (`docker/postgres/init-databases.sql`).

If the cost of three instances matters more than the automation, create one
instance in the Blueprint, `CREATE DATABASE "synapgrid-sessions";` and
`"synapgrid-preferences";` on it from the dashboard's PSQL console, and hand-edit
the two services' `DATABASE_URL` to the instance's **Internal Database URL** with
the database name swapped. Do not point all three services at one database:
nothing enforces the boundary at runtime, so the mistake stays invisible until
two services' migrations collide.

### Migrations

Each HTTP service runs its own migration as `preDeployCommand`, inside the built
image and from the repo root:

```
npx --no-install prisma migrate deploy --schema apps/identity-service/prisma/schema.prisma
```

`--schema` is the important part. The obvious `pnpm run db:deploy` is a
workspace-wide `turbo db:deploy`, which would run all three services' migrations
against whichever single `DATABASE_URL` that service has — a deploy that
half-succeeds and then fails on the first conflicting table. `npx --no-install`
also avoids depending on pnpm at pre-deploy time: the runtime stage of every
Dockerfile copies the repository's `node_modules`, which is where the Prisma
CLI lives.

## Environment variable matrix

| Variable | identity | session | preference | fanout | Source |
|---|---|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ | — | per-service Postgres instance |
| `REDIS_URL` | — | — | — | ✅ | Key Value internal URL |
| `JWT_SECRET` | ✅ issues | ✅ verifies | — | — | `backend-shared` group, generated once |
| `PARTICIPANT_TOKEN_SECRET` | — | ✅ issues | ✅ verifies | ✅ verifies | `backend-shared` group, generated once |
| `CORS_ORIGINS` | ✅ | ✅ | ✅ | ✅ | you, at creation |
| `KAFKA_BOOTSTRAP_SERVERS` | ✅ | ✅ | ✅ | ✅ | `backend-shared` group |
| `KAFKA_SECURITY_PROTOCOL` | ✅ | ✅ | ✅ | ✅ | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | ✅ | ✅ | ✅ | ✅ | `plain` |
| `KAFKA_USERNAME` / `KAFKA_PASSWORD` | ✅ | ✅ | ✅ | ✅ | Aiven service user |
| `KAFKA_CA_CERT` | ✅ | ✅ | ✅ | ✅ | path inside the image |
| `PREFERENCE_SERVICE_HOST` | — | ✅ | — | — | referenced from preference-service |
| `FANOUT_STREAM_MAXLEN` | — | — | — | ✅ | `render.yaml` |
| `PORT` | ✅ | ✅ | ✅ | ✅ | Render sets it; every service reads it |

Kafka settings are read by `kafkaClientConfig()` in
[`libs/kafka-contracts/src/kafka-connection.ts`](../libs/kafka-contracts/src/kafka-connection.ts),
which every service now uses for its Kafka client. Missing credentials for
`SASL_SSL`, or no broker at all, makes the service throw at boot — a crash loop
immediately after deploy is usually one of those.

`KAFKA_BROKER` is still accepted as the old name for `KAFKA_BOOTSTRAP_SERVERS`,
so existing `.env` files keep working.

## WebSockets (fanout-service)

- Connect clients with `transports: ["websocket"]`, as
  [apps/fanout-service/README.md](../apps/fanout-service/README.md) shows.
  Render's load balancer gives no sticky sessions, so socket.io's default
  long-polling handshake fails intermittently as soon as there is more than one
  instance.
- More than one instance is fine: they share the `fanout-service` Kafka consumer
  group, and the Redis streams adapter delivers a caption consumed by one
  instance to sockets held by all. Raise `numInstances` or enable autoscaling
  when you need it.
- Reconnection recovery depends on that same Redis instance; if Key Value is
  unreachable, fanout-service exits at boot rather than running without it.

## Verifying a deployment

```bash
BASE=https://<service-domain>
curl -s $BASE/healthz                          # expect OK
curl -s $BASE/api/openapi.json | head -c 200   # confirms WHICH service answers
```

The `title` in that spec tells you what is actually running — the quickest way to
catch "the docs look wrong" when the wrong service is on the domain.

Then end to end:

```bash
curl -sX POST $IDENTITY/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"<strong>","name":"You"}'
# -> accessToken, which session-service accepts (preference-service takes a
#    participant token instead, issued on join)
```

For fanout, join a session to get a `participantToken`, connect a socket, and
publish an `ai.transcript.segment` to Kafka
(`apps/fanout-service/test/load/fanout-load.ts` does all three).

fanout-service connects to Redis and joins the Kafka consumer group before it
starts listening, so a domain that answers there proves both. The HTTP services
can answer `/healthz` while Kafka is unreachable — see "Static `/healthz`" in
Gaps below.

## Build notes (why the Dockerfiles look like this)

Each service builds from its own Dockerfile **with the repository root as the
build context**, because every app depends on the workspace (`libs/*`, the
lockfile, `turbo.json`). The pattern that works, now applied to all five:

- `corepack enable && corepack prepare pnpm@8.6.0 --activate` — `node:20-alpine`
  ships no pnpm, and the version must match `packageManager` in the root
  `package.json`: a newer pnpm rewrites the lockfile format and
  `pnpm install --frozen-lockfile` then fails.
- Workspace manifests are copied **before** the install so a source change does
  not invalidate the dependency layer.
- `pnpm build --filter=<service>` builds the libraries first (`build` depends on
  `^build`) and runs `prisma generate` (`build` depends on `db:generate`).
- The runtime stage copies `apps/<service>` whole, which carries `dist/`, the
  service-local generated Prisma client in `generated/`, and the pnpm links into
  `libs/`; `WORKDIR` moves into it so `node dist/main.js` resolves.
- `apk add --no-cache openssl` for the services with Prisma, whose query engine
  links against OpenSSL.
- `certs/` is copied so `KAFKA_CA_CERT` has a file to read.
- `.dockerignore` keeps the host's `node_modules` out of the context — a Windows
  `node_modules` would replace the Linux one and break native modules like
  bcrypt.

Migrations run as `preDeployCommand` inside the built image, so a deploy fails
before serving traffic if a migration fails — see "Migrations" above for the
exact command and why it names one schema.

## Gaps to know about before this is production-ready

Tracked in [DEVELOPMENT-STATUS.md](DEVELOPMENT-STATUS.md); the Render-relevant
ones:

- **`/healthz` is a static string.** It does not check Postgres, Kafka or Redis,
  so a service can report healthy while unable to serve.
- **Event delivery is at-most-once.** If Kafka is briefly unreachable, an event
  is lost with a log line.
- **No metrics or tracing.** Render's own instance metrics are all you get.
- The `fanout-service` `realtime/` code path (participant tokens, Redis
  streams) is what `render.yaml` provisions for; confirm it matches what the
  web app expects before pointing clients at the deployed domain.
