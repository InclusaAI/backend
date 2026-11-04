import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { kafkaClientConfig } from '@inclusaai/kafka-contracts';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CONSUMER',
        imports: [ConfigModule],
        useFactory: () => ({
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
        }),
      },
    ]),
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_PRODUCER',
        imports: [ConfigModule],
        useFactory: () => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'presenter-assist-producer',
              ...kafkaClientConfig(),
            },
          },
        }),
      },
    ]),
  ],
  exports: ['KAFKA_CONSUMER', 'KAFKA_PRODUCER'],
})
export class KafkaModule {}
