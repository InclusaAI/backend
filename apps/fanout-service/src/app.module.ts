import { Module } from "@nestjs/common";
import { join } from "path";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { RealtimeModule } from "./realtime/realtime.module";

@Module({
  // App .env first (the first path wins); ../../.env is the repo-root
  // general env shared by every service. Missing files are skipped, which is
  // how Docker/Render — where the platform injects real env vars — keeps working.
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", join(process.cwd(), "..", "..", ".env")],
    }),
    RealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
