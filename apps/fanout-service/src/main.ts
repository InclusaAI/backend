import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { setupSwagger } from "./swagger";
import { RedisIoAdapter } from "./realtime/redis-io.adapter";

/** How long a client may be gone and still be caught up on what it missed. */
const RECOVERY_WINDOW_MS = 2 * 60 * 1000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  // Without this the shutdown hooks that close Redis and the Kafka consumer
  // never run on SIGTERM.
  app.enableShutdownHooks();

  const corsOrigins = config
    .get<string>("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: corsOrigins, credentials: true });

  const redisAdapter = new RedisIoAdapter(app, {
    redisUrl: config.get<string>("REDIS_URL", "redis://localhost:6379"),
    corsOrigins,
    streamMaxLen: Number(config.get<string>("FANOUT_STREAM_MAXLEN", "100000")),
    recoveryWindowMs: RECOVERY_WINDOW_MS,
  });
  await redisAdapter.connect();
  app.useWebSocketAdapter(redisAdapter);

  // One consumer group across all instances: each event is handled once, and
  // the Redis adapter delivers the broadcast to sockets on every instance.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: "fanout-service",
        brokers: [config.getOrThrow<string>("KAFKA_BROKER")],
      },
      consumer: {
        groupId: "fanout-service",
      },
    },
  });

  setupSwagger(app);

  await app.startAllMicroservices();

  const port = config.get<number>("PORT", 3004);
  await app.listen(port);
  new Logger("Bootstrap").log(`fanout-service listening on ${port}`);
}
bootstrap();
