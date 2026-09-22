import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Delete,
} from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { CreateSessionDto } from "./dto/create-session.dto";
import { JoinSessionDto } from "./dto/join-session.dto";
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
  @ApiResponse({ status: 201, description: "Joined; participant returned." })
  @ApiResponse({ status: 404, description: "No session for that join code." })
  @ApiResponse({ status: 409, description: "Session is not active." })
  async join(
    @Body() joinSessionDto: JoinSessionDto,
    @Req() req: Request,
  ): Promise<SessionParticipant> {
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    const bearerToken = req.headers.authorization?.replace(/^Bearer\s+/i, "");

    return this.sessionsService.join(joinSessionDto, userId, bearerToken);
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
