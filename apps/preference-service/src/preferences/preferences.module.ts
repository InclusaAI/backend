import { Module } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { PreferencesController } from "./preferences.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { KafkaModule } from "../kafka/kafka.module";

@Module({
  imports: [PrismaModule, KafkaModule],
  controllers: [PreferencesController],
  providers: [PreferencesService],
})
export class PreferencesModule {}
