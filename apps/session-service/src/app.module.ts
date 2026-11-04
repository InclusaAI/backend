import { Module } from "@nestjs/common";
import { join } from "path";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PresentationsModule } from "./presentations/presentations.module";
import { SessionsModule } from "./sessions/sessions.module";

@Module({
  imports: [
    // App .env first (the first path wins); ../../.env is the repo-root
    // general env shared by every service. Missing files are skipped, which is
    // how Docker/Render — where the platform injects real env vars — keeps working.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", join(process.cwd(), "..", "..", ".env")],
    }),
    AuthModule,
    PrismaModule,
    PresentationsModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
