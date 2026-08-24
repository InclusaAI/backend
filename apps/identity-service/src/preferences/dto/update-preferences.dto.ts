import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  captionsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  avatarEnabled?: boolean;
}