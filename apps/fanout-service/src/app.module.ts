import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { FanoutModule } from "./fanout/fanout.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    FanoutModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
