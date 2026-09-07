import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AssistModule } from "./assist/assist.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AssistModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
