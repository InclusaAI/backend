"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("./swagger");
const microservices_1 = require("@nestjs/microservices");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.connectMicroservice({
        transport: microservices_1.Transport.KAFKA,
        options: {
            client: {
                brokers: [process.env.KAFKA_BROKER],
            },
            consumer: {
                groupId: 'session-service-consumer',
            },
        },
    });
    await app.startAllMicroservices();
    (0, swagger_1.setupSwagger)(app);
    await app.listen(3002);
}
bootstrap();
//# sourceMappingURL=main.js.map