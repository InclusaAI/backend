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
exports.InvitationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("crypto");
const date_fns_1 = require("date-fns");
const microservices_1 = require("@nestjs/microservices");
const kafka_module_1 = require("../kafka/kafka.module");
const kafka_contracts_1 = require("@inclusaai/kafka-contracts");
let InvitationsService = exports.InvitationsService = class InvitationsService {
    constructor(prisma, kafkaClient) {
        this.prisma = prisma;
        this.kafkaClient = kafkaClient;
    }
    async onModuleDestroy() {
        await this.kafkaClient.close();
    }
    async create(createInvitationDto, inviterId) {
        const { email, organizationId } = createInvitationDto;
        const inviterMembership = await this.prisma.orgMembership.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: inviterId,
                },
            },
            include: {
                user: true,
                organization: true,
            }
        });
        if (!inviterMembership || inviterMembership.role !== 'ADMIN') {
            throw new common_1.ForbiddenException('You do not have permission to invite users to this organization.');
        }
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            const existingMembership = await this.prisma.orgMembership.findFirst({
                where: {
                    organizationId,
                    userId: existingUser.id,
                },
            });
            if (existingMembership) {
                throw new common_1.ConflictException('This user is already a member of the organization.');
            }
        }
        const existingInvitation = await this.prisma.invitation.findFirst({
            where: {
                email,
                organizationId,
                status: 'PENDING',
            }
        });
        if (existingInvitation) {
            throw new common_1.ConflictException('An invitation for this email address to this organization is already pending.');
        }
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = (0, date_fns_1.add)(new Date(), { days: 7 });
        const invitation = await this.prisma.invitation.create({
            data: {
                email,
                organizationId,
                inviterId,
                token,
                expiresAt,
            },
        });
        const payload = {
            invitationId: invitation.id,
            email: invitation.email,
            organizationName: inviterMembership.organization.name,
            inviterName: inviterMembership.user.name,
        };
        this.kafkaClient.emit(kafka_contracts_1.INVITATION_CREATED_EVENT, payload);
        return {
            message: 'Invitation sent successfully.',
            invitationId: invitation.id,
        };
    }
};
exports.InvitationsService = InvitationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(kafka_module_1.KAFKA_SERVICE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        microservices_1.ClientKafka])
], InvitationsService);
//# sourceMappingURL=invitations.service.js.map