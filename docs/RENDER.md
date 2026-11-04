# Deploying on Render

Render-specific setup for this repository. [DEPLOYMENT.md](DEPLOYMENT.md) covers
the shape of the system (four services, no gateway, one database per service
boundary); this file is the part that differs per host: the blueprint, the exact
settings, and what Render does not provide.

Everything here is encoded in [`render.yaml`](../render.yaml) at the repo root,
which creates all four services and the Key Value instance in one go. The
database is **not** created by Render: the free Postgres expires after 30 days,
so it is an external Neon Postgres that you paste in at blueprint creation. That
plus the Kafka password and the frontend origins are the values not in the file.

## What the blueprint creates

| Resource | Render type | Plan | Notes |
|---|---|---|---|
| `identity-service` | Web Service (Docker) | `free` | port from `PORT`, healthcheck `/healthz`, migrations at container start |
| `session-service` | Web Service (Docker) | `free` | as above |
| `preference-service` | Web Service (Docker) | `free` | as above |
| `fanout-service` | Web Service (Docker) | `free` | Redis + Kafka, no database |
| `inclusaai-redis` | Key Value | `free` (25 MB), `noeviction` | fanout-service only |

`presenter-assist-service` is a deferred scaffold and is not deployed.

The database is a **Neon Postgres** project you create yourself (free tier, no
expiry), wired in through the `backend-database` env group. Render's own free
Postgres is deliberately not used: it is deleted 30 days after creation. Use
Neon's **direct** connection string — the host *without* `-pooler` — because
`docker/entrypoint.sh` runs `prisma migrate deploy` over the same URL and
Prisma Migrate needs a session-level advisory lock, which PgBouncer (Neon's
pooled endpoint) cannot guarantee across transactions.

No `region` is set, so every resource lands in Render's default (`oregon`).
Keep every resource in the **same region**: a free web service can open a
private-network connection to Render data stores in its region, but it cannot
_receive_ private traffic. That is why `session-service` reaches
`preference-service` over its public URL rather than `hostport`. Also prefer the
region nearest your Aiven Kafka service, because every service holds a Kafka
connection.

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
3. Render previews the resources and asks for the values marked `sync: false`:
   - `DATABASE_URL` (group `backend-database`) — Neon's direct connection
     string for a database dedicated to this app, e.g.
     `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/inclusaai?sslmode=require`.
     Copy it from the Neon console with **Connection pooling off**; the
     `-pooler` host is not supported (see above). The database must be empty:
     `prisma migrate deploy` refuses a schema that already has tables (P3005),
     and Neon's default `neondb` often already holds another app's tables.
     Create `inclusaai` (or similar) under **Databases → New Database** first.
   - `CORS_ORIGINS` (group `backend-shared`) — your frontend origin(s),
     comma-separated (`https://app.example.com`). Without the real origin,
     browsers are blocked even though `curl` works.
   - `KAFKA_PASSWORD` (group `backend-shared`) — the Aiven service password.
4. Confirm. Render creates the Key Value instance and deploys all four
   services. The three Prisma services apply their migrations against Neon at
   container start.

`KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_SECURITY_PROTOCOL` (`SASL_SSL`),
`KAFKA_SASL_MECHANISM` (`plain`), `KAFKA_USERNAME` (`avnadmin`) and
`KAFKA_CA_CERT` (a path inside the image) are hardcoded in that same group.
Switch any of them to `sync: false`, or point the group at another broker, if
you run more than one environment.

### Why one shared database

Per ADR-0003 each service owns its own database. The free deployment shares one
Neon database across the three Prisma services because Neon's free tier is a
single database per project (and Render's free Postgres expires in 30 days, so
it is not an option at all). On paid plans, create one database per service.

This still runs each service's own migration history:

```
docker/entrypoint.sh   # in every image
  prisma migrate deploy --schema prisma/schema.prisma
```

Each service applies only the migrations in its own `apps/<service>/prisma/migrations`
folder. The three init migrations are additive and touch different tables, so
they coexist in the shared `_prisma_migrations` table. Do **not** switch this to
`prisma db push`: it syncs the entire database to one service's schema and
drops the other services' tables.

For a proper ADR-0003 setup (separate databases), create one Neon database per
service — `identity-db`, `sessions-db`, `preferences-db` with database names
`synapgrid-identity`, `synapgrid-sessions`, `synapgrid-preferences` — and point
each service's `DATABASE_URL` at its own. Nothing else changes; migrations stay
in the entrypoint.

### Migrations

Free web services do **not** support Render's `preDeployCommand`, so migrations
run inside the container before the app starts:

```
docker/entrypoint.sh
  └─ /usr/src/app/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
```

The script only runs when the image contains a Prisma schema, so
`fanout-service` skips it. Prisma is a root dependency, so its CLI is in the
copied `node_modules`. A failed migration exits non-zero and prevents the new
instance from becoming healthy, which keeps the previous deploy live.

Because three services boot independently, two of them may run `migrate deploy`
at the same moment. That is safe: Prisma takes a Postgres advisory lock and the
second waits, which is also the reason the URL must be a direct connection
rather than PgBouncer.

### Neon notes

- Use the **direct** host. The `-pooler` host is PgBouncer in transaction mode;
  Prisma Migrate's session-level advisory lock is not reliable there, and Prisma
  needs `?pgbouncer=true` to avoid prepared-statement errors at runtime.
- `sslmode=require` encrypts but does not verify the server certificate. Use
  `sslmode=verify-full` if you want full verification; both work with Neon.
- Neon's free compute suspends after a few minutes of inactivity. Combined with
  Render's own spin-down, expect a slow first request after idle; that is
  normal, not a healthcheck failure.
- `prisma migrate deploy` fails with **P3005 / "schema is not empty"** if the
  database already contains any table. Give the services their own empty
  database rather than reusing one that another project writes to.

## Environment variable matrix

| Variable | identity | session | preference | fanout | Source |
|---|---|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ | — | `backend-database` group — your Neon direct URL |
| `REDIS_URL` | — | — | — | ✅ | Key Value internal URL |
| `JWT_SECRET` | ✅ issues | ✅ verifies | — | — | `backend-shared` group, generated once |
| `PARTICIPANT_TOKEN_SECRET` | — | ✅ issues | ✅ verifies | ✅ verifies | `backend-shared` group, generated once |
| `CORS_ORIGINS` | ✅ | ✅ | ✅ | ✅ | you, at creation |
| `KAFKA_BOOTSTRAP_SERVERS` | ✅ | ✅ | ✅ | ✅ | `backend-shared` group |
| `KAFKA_SECURITY_PROTOCOL` | ✅ | ✅ | ✅ | ✅ | `SASL_SSL` |
| `KAFKA_SASL_MECHANISM` | ✅ | ✅ | ✅ | ✅ | `plain` |
| `KAFKA_USERNAME` / `KAFKA_PASSWORD` | ✅ | ✅ | ✅ | ✅ | Aiven service user |
| `KAFKA_CA_CERT` | ✅ | ✅ | ✅ | ✅ | path inside the image |
| `PREFERENCE_SERVICE_URL` | — | ✅ | — | — | preference-service's public `RENDER_EXTERNAL_URL` (free plan) |
| `FANOUT_STREAM_MAXLEN` | — | — | — | ✅ | `render.yaml` (sized for the 25 MB free Key Value) |
| `PORT` | ✅ | ✅ | ✅ | ✅ | Render sets it; every service reads it |

`PREFERENCE_SERVICE_URL` is wired with `fromService: { name: preference-service,
envVarKey: RENDER_EXTERNAL_URL }`, which resolves to that service's public
`https://…onrender.com` origin. If the Blueprint rejects a cross-service
`envVarKey`, set the same key to `sync: false` and paste the URL in the dashboard
instead — session-service accepts either the full URL or `PREFERENCE_SERVICE_HOST`
+ port.

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
- The free Key Value instance is only **25 MB** and is in-memory only. The
  blueprint sets `FANOUT_STREAM_MAXLEN=10000` so the event stream cannot fill
  it; raise that value (and the Key Value plan) if you need a longer recovery
  window or high caption volume. Free web services also spin down after 15
  minutes without traffic, which drops all WebSocket connections.

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
- `docker/entrypoint.sh` runs `prisma migrate deploy` for the database-backed
  images before exec'ing the CMD. This replaces Render's `preDeployCommand`,
  which free web services do not support.
- `.dockerignore` keeps the host's `node_modules` out of the context — a Windows
  `node_modules` would replace the Linux one and break native modules like
  bcrypt.

Migrations run before the app starts, so a deploy fails before serving traffic
if a migration fails.

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
