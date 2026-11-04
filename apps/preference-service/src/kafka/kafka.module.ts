import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { kafkaClientConfig } from '@inclusaai/kafka-contracts';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'KAFKA_SERVICE',
      useFactory: () => {
        return ClientProxyFactory.create({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'preference-service',
              ...kafkaClientConfig(),
            },
          },
        });
      },
    },
  ],
  exports: ['KAFKA_SERVICE'],
})
export class KafkaModule {}
