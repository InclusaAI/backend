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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePresentationDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SlideDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The order of the slide in the presentation.' }),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], SlideDto.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The placeholder URL for the slide image.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SlideDto.prototype, "url", void 0);
class CreatePresentationDto {
}
exports.CreatePresentationDto = CreatePresentationDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'My Q3 Earnings Report',
        description: 'The name of the presentation.',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePresentationDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Metadata for the slides in the presentation.',
        type: [SlideDto],
    }),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreatePresentationDto.prototype, "slideMetadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'The ID of the organization this presentation belongs to.',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePresentationDto.prototype, "organizationId", void 0);
//# sourceMappingURL=create-presentation.dto.js.map