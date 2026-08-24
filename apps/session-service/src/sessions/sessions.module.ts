import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { KafkaController } from './kafka.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { KafkaModule } from '../kafka/kafka.module';

@Module({
  imports: [PrismaModule, KafkaModule],
  controllers: [SessionsController, KafkaController],
  providers: [SessionsService],
})
export class SessionsModule {}