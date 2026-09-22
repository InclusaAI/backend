import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { SessionsService } from "./sessions.service";
import { SessionsController } from "./sessions.controller";
import { KafkaController } from "./kafka.controller";
import { PreferenceClientService } from "./preference-client.service";
import { PrismaModule } from "../prisma/prisma.module";
import { KafkaModule } from "../kafka/kafka.module";

// AuthModule is imported once in AppModule; the 'jwt' strategy it registers
// lives in Passport's global registry, so guards here resolve without it.
@Module({
  imports: [PrismaModule, KafkaModule, HttpModule],
  controllers: [SessionsController, KafkaController],
  providers: [SessionsService, PreferenceClientService],
})
export class SessionsModule {}
