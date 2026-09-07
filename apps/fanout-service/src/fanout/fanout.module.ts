import { Module } from '@nestjs/common';
import { FanoutGateway } from './fanout.gateway';
import { FanoutEventsController } from './fanout-events.controller';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [KafkaModule],
  controllers: [FanoutEventsController],
  providers: [FanoutGateway],
  exports: [FanoutGateway],
})
export class FanoutModule {}
