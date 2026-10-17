-- One logical database per service, per ADR-0003.
--
-- A schema change in session-service must not be able to lock a table that
-- preference-service reads, and no service can join across another's data
-- even by accident. They share a single Postgres instance at MVP scale.
--
-- Names match the convention already in use in local .env files
-- (synapgrid-<service>).
--
-- Postgres runs this only when the data directory is empty. If you already
-- have a postgres-data volume from an earlier run:
--   docker compose -f docker-compose.dev.yml down -v

CREATE DATABASE "synapgrid-identity";
CREATE DATABASE "synapgrid-sessions";
CREATE DATABASE "synapgrid-preferences";

GRANT ALL PRIVILEGES ON DATABASE "synapgrid-identity" TO "user";
GRANT ALL PRIVILEGES ON DATABASE "synapgrid-sessions" TO "user";
GRANT ALL PRIVILEGES ON DATABASE "synapgrid-preferences" TO "user";
