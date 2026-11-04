import { readFileSync } from "fs";

/**
 * Kafka connection config shared by every service in this repo.
 *
 * Local development talks plain TEXT to the Redpanda broker in
 * `docker-compose.dev.yml`, which needs nothing but a host:port. Hosted brokers
 * (Aiven Cloud Kafka and equivalents) terminate TLS and require SASL
 * credentials, so the broker address alone is not enough — the protocol,
 * mechanism, credentials and CA certificate all have to travel together.
 *
 * Environment variable names deliberately match the ones ai-services already
 * uses for the same broker, so one set of values configures both repos:
 *
 *   KAFKA_BOOTSTRAP_SERVERS   host:port[,host:port]   (KAFKA_BROKER is the
 *                        legacy alias and is still accepted)
 *   KAFKA_SECURITY_PROTOCOL  PLAINTEXT | SSL | SASL_SSL | SASL_PLAINTEXT
 *   KAFKA_SASL_MECHANISM     plain | scram-sha-256 | scram-sha-512
 *   KAFKA_USERNAME           SASL username (service user in Aiven)
 *   KAFKA_PASSWORD           SASL password
 *   KAFKA_CA_CERT            PEM contents, or a path to a PEM file
 *   KAFKA_CONNECTION_TIMEOUT_MS  per-broker connect timeout (default 10000,
 *                        kafkajs uses 3000 — too tight for a TLS handshake to a
 *                        broker on another continent, which then looks like a
 *                        broker outage in the boot logs)
 *   KAFKA_TLS_REJECT_UNAUTHORIZED  "false" skips certificate verification
 *                        (debugging only — never in a real deployment)
 *
 * With nothing set but a broker address the result is the same PLAINTEXT
 * connection used locally, so this is a no-op for existing setups.
 */

/** The subset of the environment this module reads. */
export interface KafkaConnectionEnv {
  KAFKA_BOOTSTRAP_SERVERS?: string;
  KAFKA_BROKER?: string;
  KAFKA_SECURITY_PROTOCOL?: string;
  KAFKA_SASL_MECHANISM?: string;
  KAFKA_USERNAME?: string;
  KAFKA_PASSWORD?: string;
  KAFKA_CA_CERT?: string;
  KAFKA_CONNECTION_TIMEOUT_MS?: string;
  KAFKA_TLS_REJECT_UNAUTHORIZED?: string;
}

export type KafkaSaslMechanism =
  | "plain"
  | "scram-sha-256"
  | "scram-sha-512";

/**
 * SASL credentials, as a union of objects each holding ONE mechanism literal.
 * kafkajs (and the Nest Kafka interface over it) types SASL options that way:
 * a single object whose `mechanism` is a union of literals is not assignable to
 * it, which would force a cast at every call site.
 */
export type KafkaSaslConfig =
  | { mechanism: "plain"; username: string; password: string }
  | { mechanism: "scram-sha-256"; username: string; password: string }
  | { mechanism: "scram-sha-512"; username: string; password: string };

/**
 * Structurally compatible with kafkajs's `KafkaConfig` client options, which is
 * what `@nestjs/microservices` passes through. Typed here rather than imported
 * so this package keeps no runtime dependency of its own.
 */
export interface KafkaClientConfig {
  brokers: string[];
  ssl?: boolean | { ca?: string[]; rejectUnauthorized?: boolean };
  sasl?: KafkaSaslConfig;
  connectionTimeout?: number;
}

/** kafkajs defaults to 3 s, which a transcontinental TLS handshake can exceed. */
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;

/** Build the `client` block for a Kafka transport from the environment. */
export function kafkaClientConfig(
  env: KafkaConnectionEnv = process.env as KafkaConnectionEnv,
): KafkaClientConfig {
  const config: KafkaClientConfig = {
    brokers: kafkaBrokers(env),
    connectionTimeout: kafkaConnectionTimeout(env),
  };
  const protocol = (trimmed(env, "KAFKA_SECURITY_PROTOCOL") ?? "PLAINTEXT").toUpperCase();

  const needsTls = protocol === "SSL" || protocol === "SASL_SSL";
  const needsSasl = protocol === "SASL_SSL" || protocol === "SASL_PLAINTEXT";

  if (!["PLAINTEXT", "SSL", "SASL_SSL", "SASL_PLAINTEXT"].includes(protocol)) {
    throw new Error(
      `Unsupported KAFKA_SECURITY_PROTOCOL "${protocol}" (expected PLAINTEXT, SSL, SASL_SSL or SASL_PLAINTEXT).`,
    );
  }

  if (needsTls) {
    const ca = kafkaCaCerts(env);
    config.ssl = {
      ...(ca ? { ca } : {}),
      rejectUnauthorized: rejectUnauthorized(env),
    };
  }

  if (needsSasl) {
    const username = trimmed(env, "KAFKA_USERNAME");
    const password = trimmed(env, "KAFKA_PASSWORD");
    if (!username || !password) {
      throw new Error(
        `KAFKA_SECURITY_PROTOCOL=${protocol} requires KAFKA_USERNAME and KAFKA_PASSWORD.`,
      );
    }
    const mechanism = kafkaSaslMechanism(env);
    config.sasl = kafkaSaslConfig(mechanism, username, password);
  }

  return config;
}

/**
 * Broker addresses, from `KAFKA_BOOTSTRAP_SERVERS` or the legacy
 * `KAFKA_BROKER`. Throws when neither is set, so a service exits at boot
 * instead of silently never connecting.
 */
export function kafkaBrokers(env: KafkaConnectionEnv = process.env as KafkaConnectionEnv): string[] {
  const raw =
    trimmed(env, "KAFKA_BOOTSTRAP_SERVERS") ?? trimmed(env, "KAFKA_BROKER");
  if (!raw) {
    throw new Error(
      "KAFKA_BOOTSTRAP_SERVERS (or KAFKA_BROKER) is required — e.g. localhost:9092 locally, host.aivencloud.com:27345 when hosted.",
    );
  }
  const brokers = raw.split(",").map((broker) => broker.trim()).filter(Boolean);
  if (brokers.length === 0) {
    throw new Error(`No broker parsed from KAFKA_BOOTSTRAP_SERVERS value "${raw}".`);
  }
  return brokers;
}

function kafkaSaslMechanism(env: KafkaConnectionEnv): KafkaSaslMechanism {
  const mechanism = (trimmed(env, "KAFKA_SASL_MECHANISM") ?? "plain").toLowerCase();
  if (!["plain", "scram-sha-256", "scram-sha-512"].includes(mechanism)) {
    throw new Error(
      `Unsupported KAFKA_SASL_MECHANISM "${mechanism}" (expected plain, scram-sha-256 or scram-sha-512).`,
    );
  }
  return mechanism as KafkaSaslMechanism;
}

function kafkaSaslConfig(
  mechanism: KafkaSaslMechanism,
  username: string,
  password: string,
): KafkaSaslConfig {
  switch (mechanism) {
    case "scram-sha-256":
      return { mechanism: "scram-sha-256", username, password };
    case "scram-sha-512":
      return { mechanism: "scram-sha-512", username, password };
    default:
      return { mechanism: "plain", username, password };
  }
}

/**
 * `KAFKA_CA_CERT` accepts either the PEM itself or a path to a file holding it.
 * Hosting platforms make the path easier (a certificate copied into the image),
 * local runs make the inline form easier, so support both.
 */
function kafkaCaCerts(env: KafkaConnectionEnv): string[] | undefined {
  const cert = trimmed(env, "KAFKA_CA_CERT");
  if (!cert) return undefined;
  if (cert.includes("BEGIN CERTIFICATE")) return [cert];

  const path = cert.replace(/^file:\/\//, "");
  try {
    return [readFileSync(path, "utf8")];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`KAFKA_CA_CERT is not inline PEM and could not be read as a file: ${message}`);
  }
}

function rejectUnauthorized(env: KafkaConnectionEnv): boolean {
  return trimmed(env, "KAFKA_TLS_REJECT_UNAUTHORIZED")?.toLowerCase() !== "false";
}

function kafkaConnectionTimeout(env: KafkaConnectionEnv): number {
  const raw = trimmed(env, "KAFKA_CONNECTION_TIMEOUT_MS");
  if (!raw) return DEFAULT_CONNECTION_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `KAFKA_CONNECTION_TIMEOUT_MS must be a positive number of milliseconds, got "${raw}".`,
    );
  }
  return parsed;
}

function trimmed(env: KafkaConnectionEnv, key: keyof KafkaConnectionEnv): string | undefined {
  const value = env[key];
  return value && value.trim() ? value.trim() : undefined;
}
