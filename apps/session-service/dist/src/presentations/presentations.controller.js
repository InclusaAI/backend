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
exports.PresentationsController = void 0;
const common_1 = require("@nestjs/common");
const presentations_service_1 = require("./presentations.service");
const create_presentation_dto_1 = require("./dto/create-presentation.dto");
const shared_auth_1 = require("@inclusaai/shared-auth");
const swagger_1 = require("@nestjs/swagger");
let PresentationsController = exports.PresentationsController = class PresentationsController {
    constructor(presentationsService) {
        this.presentationsService = presentationsService;
    }
    async create(createPresentationDto, req) {
        const userId = req.user.userId;
        return this.presentationsService.create(createPresentationDto, userId);
    }
};
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new presentation' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'The presentation has been successfully created.',
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized.' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_presentation_dto_1.CreatePresentationDto, Object]),
    __metadata("design:returntype", Promise)
], PresentationsController.prototype, "create", null);
exports.PresentationsController = PresentationsController = __decorate([
    (0, swagger_1.ApiTags)('Presentations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(shared_auth_1.JwtAuthGuard),
    (0, common_1.Controller)('presentations'),
    __metadata("design:paramtypes", [presentations_service_1.PresentationsService])
], PresentationsController);
//# sourceMappingURL=presentations.controller.js.map