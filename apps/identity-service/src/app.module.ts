import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { InvitationsModule } from './invitations/invitations.module';

@Module({
  imports: [AuthModule, PrismaModule, OrganizationsModule, InvitationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}