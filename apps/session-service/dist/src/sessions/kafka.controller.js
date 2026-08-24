"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const kafka_contracts_1 = require("@inclusaai/kafka-contracts");
const sessions_service_1 = require("./sessions.service");
let KafkaController = exports.KafkaController = class KafkaController {
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    async handleAccessibilityPreferenceUpdated(message) {
        console.log(`Received accessibility preference update for user ${message.userId}`);
        await this.sessionsService.updateAccessibilityPreferences(message.userId, message.captionsEnabled, message.avatarEnabled);
    }
};
__decorate([
    (0, microservices_1.MessagePattern)(kafka_contracts_1.ACCESSIBILITY_PREFERENCE_UPDATED_EVENT),
    __param(0, (0, microservices_1.Payload)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KafkaController.prototype, "handleAccessibilityPreferenceUpdated", null);
exports.KafkaController = KafkaController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], KafkaController);
//# sourceMappingURL=kafka.controller.js.map