import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { JwtAuthGuard } from "@inclusaai/shared-auth";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request } from "express";

@ApiTags("Organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new organization" })
  @ApiResponse({
    status: 201,
    description: "The organization has been successfully created.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  create(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).userId;
    return this.organizationsService.create(createOrganizationDto, userId);
  }
}
