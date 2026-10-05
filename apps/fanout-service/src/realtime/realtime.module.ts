import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { RedisModule } from "../redis/redis.module";
import { CaptionsGateway } from "./captions.gateway";
import { FanoutEventsController } from "./fanout-events.controller";
import { ParticipantStateStore } from "./participant-state.store";
import { ParticipantTokenService } from "./participant-token.service";

@Module({
  imports: [
    RedisModule,
    // Participant tokens only. This service never verifies account tokens, so
    // it has no JWT_SECRET and no Passport strategy.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("PARTICIPANT_TOKEN_SECRET"),
      }),
    }),
  ],
  controllers: [FanoutEventsController],
  providers: [CaptionsGateway, ParticipantStateStore, ParticipantTokenService],
})
export class RealtimeModule {}
