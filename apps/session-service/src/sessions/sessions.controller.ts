import { Controller, Post, Body, UseGuards, Req, Param, Delete } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '@inclusaai/shared-auth';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { Session } from '@prisma/client';

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('presentations/:id/sessions')
  @ApiOperation({ summary: 'Start a new session for a presentation' })
  @ApiParam({ name: 'id', description: 'The ID of the presentation' })
  @ApiResponse({
    status: 201,
    description: 'The session has been successfully started.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Presentation not found.' })
  async start(
    @Param('id') presentationId: string,
    @Body() createSessionDto: CreateSessionDto,
    @Req() req: Request,
  ): Promise<Session> {
    const userId = (req.user as any).userId;
    return this.sessionsService.start(presentationId, createSessionDto, userId);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'End a session' })
  @ApiParam({ name: 'id', description: 'The ID of the session' })
  @ApiResponse({
    status: 200,
    description: 'The session has been successfully ended.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  async end(@Param('id') sessionId: string, @Req() req: Request): Promise<Session> {
    const userId = (req.user as any).userId;
    return this.sessionsService.end(sessionId, userId);
  }
}