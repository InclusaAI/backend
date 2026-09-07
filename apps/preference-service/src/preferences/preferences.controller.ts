import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { PreferencesService } from './preferences.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';

@ApiTags('Preferences')
@Controller('api/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create or update accessibility preferences',
    description:
      'Sets the accessibility channels a participant needs for a session. ' +
      'Publishes accessibility.preference.updated to Kafka for ai-services preference-aware gating.',
  })
  @ApiResponse({ status: 201, description: 'Preferences created/updated successfully.' })
  async upsertPreference(@Body() dto: CreatePreferenceDto) {
    return this.preferencesService.upsertPreference(dto);
  }

  @Get(':sessionId/:participantId')
  @ApiOperation({ summary: 'Get preferences for a participant in a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'participantId', description: 'Participant ID' })
  @ApiResponse({ status: 200, description: 'Preferences returned (empty defaults if none set).' })
  async getPreference(
    @Param('sessionId') sessionId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.preferencesService.getPreference(sessionId, participantId);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get all preferences for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'List of participant preferences.' })
  async getSessionPreferences(@Param('sessionId') sessionId: string) {
    return this.preferencesService.getSessionPreferences(sessionId);
  }

  @Delete(':sessionId/:participantId')
  @ApiOperation({ summary: 'Remove preferences for a participant' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiParam({ name: 'participantId', description: 'Participant ID' })
  @ApiResponse({ status: 200, description: 'Preferences deleted.' })
  async deletePreference(
    @Param('sessionId') sessionId: string,
    @Param('participantId') participantId: string,
  ) {
    return this.preferencesService.deletePreference(sessionId, participantId);
  }
}
