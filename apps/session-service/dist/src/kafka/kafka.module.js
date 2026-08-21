"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const microservices_1 = require("@nestjs/microservices");
let KafkaModule = exports.KafkaModule = class KafkaModule {
};
exports.KafkaModule = KafkaModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: 'KAFKA_SERVICE',
                useFactory: (configService) => {
                    return microservices_1.ClientProxyFactory.create({
                        transport: microservices_1.Transport.KAFKA,
                        options: {
                            client: {
                                clientId: 'session-service',
                                brokers: [configService.get('KAFKA_BROKER')],
                            },
                            consumer: {
                                groupId: 'session-service-consumer',
                            },
                        },
                    });
                },
                inject: [config_1.ConfigService],
            },
        ],
        exports: ['KAFKA_SERVICE'],
    })
], KafkaModule);
//# sourceMappingURL=kafka.module.js.map