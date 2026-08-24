import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({
    description: 'Enable or disable captions for the user.',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  captionsEnabled?: boolean;

  @ApiProperty({
    description: 'Enable or disable the user avatar.',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  avatarEnabled?: boolean;
}