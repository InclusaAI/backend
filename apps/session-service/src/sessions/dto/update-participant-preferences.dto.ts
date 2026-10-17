import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateParticipantPreferencesDto {
  @ApiPropertyOptional({
    example: true,
    description: "Receive live captions in this session.",
  })
  @IsOptional()
  @IsBoolean()
  captionsEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: "Show the signing avatar in this session.",
  })
  @IsOptional()
  @IsBoolean()
  avatarEnabled?: boolean;
}
