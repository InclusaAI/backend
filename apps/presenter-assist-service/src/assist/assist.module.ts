import { Module } from '@nestjs/common';
import { AssistService } from './assist.service';
import { AssistController } from './assist.controller';
import { AssistGateway } from './assist.gateway';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [KafkaModule],
  controllers: [AssistController],
  providers: [AssistService, AssistGateway],
  exports: [AssistService, AssistGateway],
})
export class AssistModule {}
