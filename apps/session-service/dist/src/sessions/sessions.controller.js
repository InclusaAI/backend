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
exports.SessionsController = void 0;
const common_1 = require("@nestjs/common");
const sessions_service_1 = require("./sessions.service");
const create_session_dto_1 = require("./dto/create-session.dto");
const shared_auth_1 = require("@inclusaai/shared-auth");
const swagger_1 = require("@nestjs/swagger");
let SessionsController = exports.SessionsController = class SessionsController {
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    async start(presentationId, createSessionDto, req) {
        const userId = req.user.userId;
        return this.sessionsService.start(presentationId, createSessionDto, userId);
    }
    async end(sessionId, req) {
        const userId = req.user.userId;
        return this.sessionsService.end(sessionId, userId);
    }
};
__decorate([
    (0, common_1.Post)('presentations/:id/sessions'),
    (0, swagger_1.ApiOperation)({ summary: 'Start a new session for a presentation' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'The ID of the presentation' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'The session has been successfully started.',
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Presentation not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_session_dto_1.CreateSessionDto, Object]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "start", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'End a session' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'The ID of the session' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'The session has been successfully ended.',
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Session not found.' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "end", null);
exports.SessionsController = SessionsController = __decorate([
    (0, swagger_1.ApiTags)('Sessions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], SessionsController);
//# sourceMappingURL=sessions.controller.js.map