import { Module } from "@nestjs/common";
import { InvitationsService } from "./invitations.service";
import { InvitationsController } from "./invitations.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { KafkaModule } from "../kafka/kafka.module";

@Module({
  imports: [PrismaModule, KafkaModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
