import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { SessionsService } from "./sessions.service";
import { SessionsController } from "./sessions.controller";
import { KafkaController } from "./kafka.controller";
import { PreferenceClientService } from "./preference-client.service";
import { ParticipantTokenService } from "./participant-token.service";
import { ParticipantTokenGuard } from "./participant-token.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { KafkaModule } from "../kafka/kafka.module";

// AuthModule is imported once in AppModule; the 'jwt' strategy it registers
// lives in Passport's global registry, so guards here resolve without it.
@Module({
  imports: [
    PrismaModule,
    KafkaModule,
    HttpModule,
    // Participant tokens only. Account tokens are verified by the shared 'jwt'
    // strategy with JWT_SECRET; this deliberately uses a different secret.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("PARTICIPANT_TOKEN_SECRET"),
        signOptions: { expiresIn: "12h" },
      }),
    }),
  ],
  controllers: [SessionsController, KafkaController],
  providers: [
    SessionsService,
    PreferenceClientService,
    ParticipantTokenService,
    ParticipantTokenGuard,
  ],
})
export class SessionsModule {}
