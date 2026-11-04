import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { kafkaClientConfig } from '@inclusaai/kafka-contracts';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Connect Kafka microservice for consuming AI outputs
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'presenter-assist-service',
        ...kafkaClientConfig(),
      },
      consumer: {
        groupId: 'presenter-assist-consumer',
      },
    },
  });

  setupSwagger(app);

  const port = configService.get<number>('PORT') || 3005;
  await app.startAllMicroservices();
  await app.listen(port);
}
bootstrap();
