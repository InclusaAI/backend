import { Module } from "@nestjs/common";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";
import { KafkaModule } from "../kafka/kafka.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [KafkaModule, AuthModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}
