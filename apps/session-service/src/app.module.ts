import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
// import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { PresentationsModule } from './presentations/presentations.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // AuthModule,
    PrismaModule,
    PresentationsModule,
    SessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}