import { Controller, Get, Body, Patch, UseGuards, Req } from "@nestjs/common";
import { PreferencesService } from "./preferences.service";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { JwtAuthGuard } from "@inclusaai/shared-auth";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AccessibilityPreference } from "../prisma/client";

@ApiTags("Preferences")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: "Get current user preferences" })
  @ApiResponse({
    status: 200,
    description: "The user's current accessibility preferences.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  findOne(@Req() req): Promise<AccessibilityPreference> {
    // req.user is populated by the JwtAuthGuard
    return this.preferencesService.findOne(req.user.userId);
  }

  @Patch()
  @ApiOperation({ summary: "Update current user preferences" })
  @ApiResponse({
    status: 200,
    description: "The updated accessibility preferences.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  update(
    @Req() req,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ): Promise<AccessibilityPreference> {
    return this.preferencesService.update(
      req.user.userId,
      updatePreferencesDto,
    );
  }
}
