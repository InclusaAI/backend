import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Connect Kafka microservice for publishing events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'preference-service',
        brokers: [configService.get<string>('KAFKA_BROKER')],
      },
    },
  });

  setupSwagger(app);

  const port = configService.get<number>('PORT') || 3003;
  await app.startAllMicroservices();
  await app.listen(port);
}
bootstrap();