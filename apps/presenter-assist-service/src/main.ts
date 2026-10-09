import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { setupSwagger } from "./swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  setupSwagger(app);

  // PORT from the environment, not a hard-coded 3005: a host such as Railway
  // assigns the port it expects the service to listen on, and an app that
  // ignores it receives no traffic.
  const port = Number(process.env.PORT ?? 3005);
  await app.listen(port);
  new Logger("Bootstrap").log(`presenter-assist-service listening on ${port}`);
}
bootstrap();
