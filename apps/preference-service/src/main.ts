import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { kafkaClientConfig } from '@inclusaai/kafka-contracts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Without this the OnModuleDestroy hooks that close the Kafka client and the
  // Prisma connection never run on SIGTERM.
  app.enableShutdownHooks();

  // The frontend calls this service directly (there is no gateway), so its
  // origin must be allowed or browsers block every request.
  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  // Connect Kafka microservice for publishing events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'preference-service',
        ...kafkaClientConfig(),
      },
    },
  });

  setupSwagger(app);

  const port = configService.get<number>('PORT') || 3003;
  await app.startAllMicroservices();
  await app.listen(port);
}
bootstrap();
