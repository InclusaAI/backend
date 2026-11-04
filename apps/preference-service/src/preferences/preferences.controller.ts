import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { PreferencesService } from "./preferences.service";
import { CreatePreferenceDto } from "./dto/create-preference.dto";
import {
  ParticipantRequest,
  ParticipantTokenGuard,
} from "../auth/participant-token.guard";

/**
 * A participant's accessibility settings for the session they joined.
 *
 * Every endpoint is authenticated by the `participantToken` that
 * `POST /sessions/join` returns, and the session and participant ids come from
 * that token rather than the request. An anonymous attendee has no account to
 * authenticate with, and a client must not be able to read or change someone
 * else's settings.
 */
@ApiTags("Preferences")
@ApiBearerAuth("participant")
@UseGuards(ParticipantTokenGuard)
@Controller("preferences")
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Post()
  @ApiOperation({
    summary: "Set your accessibility preferences for this session",
    description:
      "Sets the accessibility channels this participant needs. Publishes accessibility.preference.updated to Kafka for ai-services preference-aware gating.",
  })
  @ApiResponse({ status: 201, description: "Preferences created/updated." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  async upsertPreference(
    @Body() dto: CreatePreferenceDto,
    @Req() req: ParticipantRequest,
  ) {
    return this.preferencesService.upsertPreference(
      req.participant.sid,
      req.participant.sub,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: "Get your preferences for this session" })
  @ApiResponse({ status: 200, description: "Preferences, or the defaults." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  async getPreference(@Req() req: ParticipantRequest) {
    return this.preferencesService.getPreference(
      req.participant.sid,
      req.participant.sub,
    );
  }

  @Delete()
  @ApiOperation({ summary: "Remove your preferences for this session" })
  @ApiResponse({ status: 200, description: "Preferences deleted." })
  @ApiResponse({ status: 401, description: "Missing or invalid token." })
  async deletePreference(@Req() req: ParticipantRequest) {
    return this.preferencesService.deletePreference(
      req.participant.sid,
      req.participant.sub,
    );
  }
}
