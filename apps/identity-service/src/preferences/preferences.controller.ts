import { Controller, Get, Body, Patch, UseGuards, Req } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '@inclusaai/shared-auth';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  findOne(@Req() req) {
    return this.preferencesService.findOne(req.user.userId);
  }

  @Patch()
  update(@Req() req, @Body() updatePreferencesDto: UpdatePreferencesDto) {
    return this.preferencesService.update(req.user.userId, updatePreferencesDto);
  }
}