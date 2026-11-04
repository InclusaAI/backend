import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ParticipantTokenGuard } from "./participant-token.guard";
import { ParticipantTokenService } from "./participant-token.service";

/**
 * Registers participant-token verification for this service.
 *
 * Participant tokens only: this service is called by a participant changing
 * their own accessibility settings, and it never verifies account tokens, so it
 * has no JWT_SECRET and no Passport strategy. Without this module the
 * preferences controller has no guard to stand behind.
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("PARTICIPANT_TOKEN_SECRET"),
      }),
    }),
  ],
  providers: [ParticipantTokenService, ParticipantTokenGuard],
  exports: [ParticipantTokenService, ParticipantTokenGuard, JwtModule],
})
export class AuthModule {}
