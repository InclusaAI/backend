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
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const microservices_1 = require("@nestjs/microservices");
const kafka_contracts_1 = require("@inclusaai/kafka-contracts");
const crypto_1 = require("crypto");
let SessionsService = exports.SessionsService = class SessionsService {
    constructor(prisma, kafkaClient) {
        this.prisma = prisma;
        this.kafkaClient = kafkaClient;
    }
    async onModuleDestroy() {
        await this.kafkaClient.close();
    }
    async start(presentationId, createSessionDto, userId) {
        const presentation = await this.prisma.presentation.findUnique({
            where: { id: presentationId },
        });
        if (!presentation) {
            throw new common_1.NotFoundException('Presentation not found.');
        }
        if (presentation.ownerId !== userId) {
            throw new common_1.UnauthorizedException('You do not own this presentation.');
        }
        const joinCode = this.generateJoinCode();
        const qrPayload = JSON.stringify({ presentationId, joinCode });
        const session = await this.prisma.session.create({
            data: {
                presentationId,
                communicationMode: createSessionDto.communicationMode,
                joinCode,
                qrPayload,
                status: 'ACTIVE',
                startedAt: new Date(),
            },
        });
        await this.createJoinToken(session.id, 24 * 60 * 60);
        const payload = {
            sessionId: session.id,
            presentationId: presentation.id,
            organizationId: presentation.organizationId,
            joinCode: session.joinCode,
        };
        this.kafkaClient.emit(kafka_contracts_1.SESSION_CREATED_EVENT, payload);
        return session;
    }
    async end(sessionId, userId) {
        const session = await this.prisma.session.findUnique({
            where: { id: sessionId },
            include: { presentation: true },
        });
        if (!session) {
            throw new common_1.NotFoundException('Session not found.');
        }
        if (session.presentation.ownerId !== userId) {
            throw new common_1.UnauthorizedException('You do not own this session.');
        }
        const updatedSession = await this.prisma.session.update({
            where: { id: sessionId },
            data: {
                status: 'ENDED',
                endedAt: new Date(),
            },
        });
        const payload = {
            sessionId: updatedSession.id,
            endedAt: updatedSession.endedAt.toISOString(),
        };
        this.kafkaClient.emit(kafka_contracts_1.SESSION_ENDED_EVENT, payload);
        return updatedSession;
    }
    generateJoinCode(length = 6) {
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    }
    async createJoinToken(sessionId, expiresInSeconds) {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
        await this.prisma.joinToken.create({
            data: {
                sessionId,
                token,
                expiresAt,
            },
        });
        return token;
    }
};
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)('KAFKA_SERVICE')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        microservices_1.ClientProxy])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map