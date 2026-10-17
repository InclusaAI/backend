import { Controller, Post, Body, UseGuards, Req } from "@nestjs/common";
import { InvitationsService } from "./invitations.service";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
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
@Controller("organizations/:organizationId/invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: "Invite a user to an organization" })
  @ApiResponse({ status: 201, description: "Invitation sent successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({
    status: 403,
    description: "Forbidden. Inviter is not an admin.",
  })
  @ApiResponse({
    status: 409,
    description: "User is already a member or an invitation is pending.",
  })
  create(
    @Body() createInvitationDto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    const inviterId = (req.user as any).userId;
    // Ensure the organizationId from the path matches the DTO
    createInvitationDto.organizationId = req.params.organizationId;
    return this.invitationsService.create(createInvitationDto, inviterId);
  }
}
