# Deployment

How this repo is meant to be hosted, written against Railway because that is
where it runs today. The shape applies to any host.

## There is no single entry point

This repo is **four deployable services plus one scaffold**, not one app. There
is no API gateway: that was decided deliberately (see "API gateway" in
[DEVELOPMENT-STATUS.md](DEVELOPMENT-STATUS.md)), and each service enables its
own CORS instead.

So every service gets its own domain, and the frontend holds four base URLs:

| Service | Local port | Needs | Role |
|---|---|---|---|
| `identity-service` | 3001 | Postgres, Kafka | accounts, orgs, invitations. **Issues the token everything else requires** |
| `session-service` | 3002 | Postgres, Kafka | presentations, sessions, participants |
| `preference-service` | 3003 | Postgres, Kafka | accessibility preferences |
| `fanout-service` | 3004 | Redis, Kafka | live captions over WebSocket. No database |
| `presenter-assist-service` | 3005 | — | scaffold, deferred post-MVP. No need to deploy it |

In user-journey terms `identity-service` is the first stop, since signup and
login issue the token the others verify. But nothing routes between them: a
client calls each directly.

If you want one hostname, that is a decision still to make. Either put a
reverse proxy in front that routes by path (`/auth/*` → identity, `/sessions/*`
→ session, and so on), or revisit the no-gateway decision. Railway will not
path-route across services for you.

## Why `/api/docs` only ever shows one service

Swagger is generated inside each Nest app from that app's own controllers, when
it boots. Each service is a separate process with its own document, and a
domain points at one service, so `https://<domain>/api/docs` can only ever show
the endpoints of the service behind that domain.

That is the explanation for the current deployment: the domain serves
`fanout-service`, whose entire HTTP surface is `GET /healthz` — the captions it
exists for travel over a WebSocket, which OpenAPI cannot describe. The other
services' docs are not missing; they are on domains that do not exist yet.

Once all four are deployed you have four docs pages. If you want them in one
place, Swagger UI can show several specs in a dropdown, so a small static page
pointed at each service's `/api/openapi.json` gives one docs URL without
introducing a gateway.

## What is deployed today

Verified against `backend-production-b3f4.up.railway.app`:

- The domain serves **fanout-service**, and it is healthy (`/healthz` → `OK`,
  socket.io handshake succeeds, and an unauthenticated socket is correctly
  refused with "A participant token is required.").
- `/auth/signup`, `/preferences` and `/presentations` return 404, so the other
  three services are not deployed.
- Redis and Kafka must both be reachable from it, because fanout connects to
  Redis and joins the Kafka consumer group *before* it starts listening. A
  serving socket proves both.
- It is running the merged `main` (PR #12), built from
  `apps/fanout-service/Dockerfile`.

## Setting up a service on Railway

One Railway service per app, all four from this same repo. Deploy from git, so
what runs is a commit you can identify.

Either point the service at a Dockerfile (how fanout runs today, see below) or
use Railway's own builder with the commands in this table.

**Leave Root Directory at the repository root.** Each app depends on the
workspace (`libs/*`, the lockfile, `turbo.json`), so an isolated subdirectory
build cannot resolve its own dependencies. Point the commands at the app
instead, here for `identity-service`:

| Setting | Value |
|---|---|
| Build | `pnpm install --frozen-lockfile && pnpm turbo build --filter=identity-service...` |
| Start | `pnpm --filter identity-service start:prod` |
| Pre-deploy | `pnpm --filter identity-service db:deploy` |
| Healthcheck path | `/healthz` |
| Watch paths | `apps/identity-service/**`, `libs/**`, `package.json`, `pnpm-lock.yaml`, `turbo.json` |

The `...` in the build filter is deliberate: it builds the app *and the
libraries it depends on*. `prisma generate` runs as part of it, because
`turbo.json` makes `build` depend on `db:generate`.

Watch paths stop a one-line change in one service from redeploying all four.
Fanout has no database, so it needs no pre-deploy command.

Railway's setting names drift; if one of the above is not there under that
name, look for the equivalent in the service's settings.

### Or build from a Dockerfile

`apps/fanout-service/Dockerfile` works and is the template for the rest. What
makes it work, and what the other four still lack:

- `corepack enable` — `node:18-alpine` ships no pnpm, so the original
  `RUN pnpm install` failed immediately.
- Copying the workspace manifests (root `package.json`, the lockfile,
  `pnpm-workspace.yaml`, and every `libs/*/package.json`) **before** installing,
  so a code change does not invalidate the dependency layer.
- `pnpm build --filter=<service>`. No `...` needed: `build` in `turbo.json`
  depends on `^build`, so the libraries are built first anyway, and on
  `db:generate`, so `prisma generate` runs for the services that have a schema.
- Copying `apps/<service>` wholesale into the production stage, which carries
  the generated Prisma client in `generated/`, then `WORKDIR` into it so
  `node dist/main.js` resolves.

The other four Dockerfiles are still the original broken pattern: pnpm on
`node:18-alpine` with no `corepack`. Until they get the same treatment, deploy
those three services with the build and start commands above, which use
Railway's own builder and need no Dockerfile.

## Data stores

**Postgres — one instance, three databases.** Per ADR-0003 each service owns its
own logical database. Railway's Postgres gives you one, so create the other two
and point each service at its own:

```sql
CREATE DATABASE "synapgrid-identity";
CREATE DATABASE "synapgrid-sessions";
CREATE DATABASE "synapgrid-preferences";
```

Then each service's `DATABASE_URL` is the Railway connection string with the
database name swapped. Do **not** point all three at one database: nothing
enforces the boundary at runtime, so the mistake stays invisible until two
services' migrations collide.

**Redis — fanout only.** It holds participant state and carries socket.io
between fanout instances.

**Kafka.** Railway has no first-party Kafka, so either run a broker (a Redpanda
or Kafka template, with a volume) or use a managed provider. Two things the
local setup does for you that production needs doing explicitly:

- **Create the topics**: `identity.invitation.created`, `session.created`,
  `session.updated`, `session.ended`, `session.participant.updated`,
  `accessibility.preference.updated`, `ai.transcript.segment`. Locally
  `kafka-init` in `docker-compose.dev.yml` does this.
- **Make `accessibility.preference.updated` compacted**
  (`cleanup.policy=compact`). It is keyed by user id and acts as the current
  setting for every participant; without compaction, retention eventually drops
  people and a consumer starting later never learns their preferences.

Use Railway's private networking (`<service>.railway.internal`) for Postgres,
Redis, Kafka and `PREFERENCE_SERVICE_URL`, so internal traffic never leaves the
project.

## Environment variables

| Variable | identity | session | preference | fanout |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ own db | ✅ own db | ✅ own db | — |
| `KAFKA_BROKER` | ✅ | ✅ | ✅ | ✅ |
| `REDIS_URL` | — | — | — | ✅ |
| `JWT_SECRET` | ✅ issues | ✅ verifies | ✅ verifies | — |
| `PARTICIPANT_TOKEN_SECRET` | — | ✅ issues | — | ✅ verifies |
| `CORS_ORIGINS` | ✅ | ✅ | ✅ | ✅ |
| `PREFERENCE_SERVICE_URL` | — | ✅ | — | — |
| `FANOUT_STREAM_MAXLEN` | — | — | — | optional |
| `PORT` | provided by Railway | | | |

Rules that matter:

- `JWT_SECRET` must be **identical** across identity, session and preference.
  Only identity issues these tokens; the others verify them.
- `PARTICIPANT_TOKEN_SECRET` must be **identical** in session and fanout, and
  **different** from `JWT_SECRET`. That separation is what stops a participant
  token acting as an account token, and vice versa.
- A secret that leaked in commit `44ecb5f` must not be reused here. Generate
  fresh ones: `openssl rand -base64 48`.
- `CORS_ORIGINS` is a comma-separated list of frontend origins. Without the
  real domain, browsers are blocked even though curl works.
- Every service reads `PORT`; Railway sets it. Ignoring it is why a service can
  deploy "successfully" and still receive no traffic.

`KAFKA_BROKER` and `PARTICIPANT_TOKEN_SECRET` are read with `getOrThrow`, so a
service exits at boot rather than running half-configured. A crash loop
immediately after deploy is usually one of these.

## WebSockets (fanout-service)

- **Clients must connect with `transports: ["websocket"]`**, as
  [apps/fanout-service/README.md](../apps/fanout-service/README.md) shows. The
  socket.io default starts with HTTP long-polling, which needs every request of
  a handshake to reach the same instance. Railway does not do sticky sessions,
  so with more than one fanout instance the default would fail intermittently.
- **Several instances are fine** otherwise: they share one Kafka consumer group,
  and the Redis streams adapter delivers a caption consumed by one instance to
  sockets held by all.
- **Reconnection needs that same Redis adapter**, which also stores the session
  state socket.io replays on reconnect. It covers roughly two minutes, bounded
  by `FANOUT_STREAM_MAXLEN` entries of shared history.

## Verifying a deployment

```bash
BASE=https://<service-domain>

curl -s $BASE/healthz                       # expect OK
curl -s $BASE/api/openapi.json | head -c 200  # confirms WHICH service answers
```

The `title` in that spec tells you what is actually running — the quickest way
to catch "the docs look wrong" when in fact the wrong service is on the domain.

Then end to end, against the real deployment:

```bash
curl -sX POST $IDENTITY/auth/signup -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"<strong>","name":"You"}'
# -> accessToken, which the other services accept
```

For fanout, connect a socket with the `participantToken` that
`POST /sessions/join` returns and publish an `ai.transcript.segment` to Kafka;
`apps/fanout-service/test/load/fanout-load.ts` is a working example.

## Known gaps before this is production-ready

Tracked in [DEVELOPMENT-STATUS.md](DEVELOPMENT-STATUS.md):

- The Dockerfiles do not build. Use Nixpacks, or fix them.
- CI points at the wrong GitHub organisation and provisions no Postgres or
  Kafka, so nothing is tested before deploy.
- `/healthz` returns a static string. It does not check Postgres, Kafka or
  Redis, so a service can look healthy while unable to serve.
- No metrics, tracing or config-schema validation (spec §8).
- Event delivery is at-most-once: an event is lost, with a log line, if Kafka
  is briefly unavailable.
