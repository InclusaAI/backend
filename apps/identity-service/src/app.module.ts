import { Module } from "@nestjs/common";
import { join } from "path";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { InvitationsModule } from "./invitations/invitations.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // App .env first — with several paths, the first file listed wins. The
      // repo-root .env is the general env shared by every service (Kafka,
      // token secrets, CORS); it is absent in Docker/Render, where the
      // platform injects real environment variables instead, and
      // missing files are skipped.
      envFilePath: [".env", join(process.cwd(), "..", "..", ".env")],
    }),
    AuthModule,
    PrismaModule,
    OrganizationsModule,
    InvitationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
