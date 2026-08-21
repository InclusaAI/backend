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
exports.InvitationsController = void 0;
const common_1 = require("@nestjs/common");
const invitations_service_1 = require("./invitations.service");
const create_invitation_dto_1 = require("./dto/create-invitation.dto");
const shared_auth_1 = require("@inclusaai/shared-auth");
const swagger_1 = require("@nestjs/swagger");
let InvitationsController = exports.InvitationsController = class InvitationsController {
    constructor(invitationsService) {
        this.invitationsService = invitationsService;
    }
    create(createInvitationDto, req) {
        const inviterId = req.user.userId;
        createInvitationDto.organizationId = req.params.organizationId;
        return this.invitationsService.create(createInvitationDto, inviterId);
    }
};
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Invite a user to an organization' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Invitation sent successfully.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized.' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden. Inviter is not an admin.' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'User is already a member or an invitation is pending.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_invitation_dto_1.CreateInvitationDto, Object]),
    __metadata("design:returntype", void 0)
], InvitationsController.prototype, "create", null);
exports.InvitationsController = InvitationsController = __decorate([
    (0, swagger_1.ApiTags)('Organizations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    (0, common_1.Controller)('organizations/:organizationId/invitations'),
    __metadata("design:paramtypes", [invitations_service_1.InvitationsService])
], InvitationsController);
//# sourceMappingURL=invitations.controller.js.map