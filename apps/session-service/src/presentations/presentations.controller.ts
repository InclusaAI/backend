import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { PresentationsService } from "./presentations.service";
import { CreatePresentationDto } from "./dto/create-presentation.dto";
import { JwtAuthGuard } from "@inclusaai/shared-auth";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request } from "express";
import { Presentation } from "../prisma/client";

@ApiTags("Presentations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("presentations")
export class PresentationsController {
  constructor(private readonly presentationsService: PresentationsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new presentation" })
  @ApiResponse({
    status: 201,
    description: "The presentation has been successfully created.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  async create(
    @Body() createPresentationDto: CreatePresentationDto,
    @Req() req: Request,
  ): Promise<Presentation> {
    const userId = (req.user as any).userId;
    return this.presentationsService.create(createPresentationDto, userId);
  }
}
