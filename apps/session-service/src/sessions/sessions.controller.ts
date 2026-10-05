import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  Param,
  Delete,
} from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { CreateSessionDto } from "./dto/create-session.dto";
import { JoinSessionDto } from "./dto/join-session.dto";
import { UpdateParticipantPreferencesDto } from "./dto/update-participant-preferences.dto";
import {
  ParticipantRequest,
  ParticipantTokenGuard,
} from "./participant-token.guard";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "@inclusaai/shared-auth";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { Request } from "express";
import { Session, SessionParticipant } from "../prisma/client";

@ApiTags("Sessions")
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  /**
   * Deliberately not behind JwtAuthGuard: an audience member scanning the QR
   * code on a projected slide must be able to join without an account.
   */
  @Post("sessions/join")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "Join a session by code",
    description:
      "Open to anonymous participants. If a bearer token is supplied the participant is linked to their account and their saved accessibility preferences are applied.",
  })
  @ApiResponse({
    status: 201,
    description:
      "Joined. Returns the participant plus `participantToken`: use it to connect to fanout-service and to call PATCH /sessions/participants/me.",
  })
  @ApiResponse({ status: 404, description: "No session for that join code." })
  @ApiResponse({ status: 409, description: "Session is not active." })
  async join(
    @Body() joinSessionDto: JoinSessionDto,
    @Req() req: Request,
  ): Promise<SessionParticipant & { participantToken: string }> {
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    const bearerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");

    return this.sessionsService.join(joinSessionDto, userId, bearerToken);
  }

  @Patch("sessions/participants/me")
  @ApiBearerAuth("participant")
  @UseGuards(ParticipantTokenGuard)
  @ApiOperation({
    summary: "Change your accessibility settings for this session",
    description:
      "Authenticated with the participantToken from POST /sessions/join, not an account token, so anonymous participants can use it. Applies to this session only; signed-in users change their saved preferences through preference-service.",
  })
  @ApiResponse({ status: 200, description: "Updated participant returned." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  @ApiResponse({ status: 404, description: "Participant not found." })
  @ApiResponse({ status: 409, description: "Session is not active." })
  async updateOwnPreferences(
    @Body() dto: UpdateParticipantPreferencesDto,
    @Req() req: ParticipantRequest,
  ): Promise<SessionParticipant> {
    return this.sessionsService.updateOwnPreferences(req.participant, dto);
  }

  @Post("presentations/:id/sessions")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Start a new session for a presentation" })
  @ApiParam({ name: "id", description: "The ID of the presentation" })
  @ApiResponse({
    status: 201,
    description: "The session has been successfully started.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 404, description: "Presentation not found." })
  async start(
    @Param("id") presentationId: string,
    @Body() createSessionDto: CreateSessionDto,
    @Req() req: Request,
  ): Promise<Session> {
    const userId = (req.user as any).userId;
    return this.sessionsService.start(presentationId, createSessionDto, userId);
  }

  @Delete("sessions/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "End a session" })
  @ApiParam({ name: "id", description: "The ID of the session" })
  @ApiResponse({
    status: 200,
    description: "The session has been successfully ended.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 404, description: "Session not found." })
  async end(
    @Param("id") sessionId: string,
    @Req() req: Request,
  ): Promise<Session> {
    const userId = (req.user as any).userId;
    return this.sessionsService.end(sessionId, userId);
  }
}
