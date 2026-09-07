import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'KAFKA_SERVICE',
      useFactory: (configService: ConfigService) => {
        return ClientProxyFactory.create({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'preference-service',
              brokers: [configService.get<string>('KAFKA_BROKER')],
            },
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: ['KAFKA_SERVICE'],
})
export class KafkaModule {}
