import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger, ValidationPipe } from "@nestjs/common";
import { Transport } from "@nestjs/microservices";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { setupSwagger } from "./swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  // Without this the OnModuleDestroy hooks that close Kafka clients and the
  // Prisma connection never run on SIGTERM.
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: config
      .get<string>("CORS_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  // Consumes accessibility.preference.updated — see sessions/kafka.controller.ts
  app.connectMicroservice({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: "session-service",
        brokers: [config.getOrThrow<string>("KAFKA_BROKER")],
      },
      consumer: {
        groupId: "session-service-consumer",
      },
    },
  });

  await app.startAllMicroservices();
  setupSwagger(app);

  const port = config.get<number>("PORT", 3002);
  await app.listen(port);
  new Logger("Bootstrap").log(`session-service listening on ${port}`);
}
bootstrap();
