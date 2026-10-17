import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class JoinSessionDto {
  @ApiProperty({
    example: "K7QM2P",
    description:
      "The 6-character code shown on the presenter's screen or encoded in the session QR code.",
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  joinCode: string;

  @ApiPropertyOptional({
    example: "Sam",
    description:
      "Name shown to the presenter. Optional for signed-in users, who are identified by their account.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;
}
