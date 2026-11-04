import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from "class-validator";

/**
 * Accessibility channels a participant may need.
 * Matches inclusaai_contracts.events.AccessibilityChannel
 */
export enum AccessibilityChannel {
  CAPTIONS = "captions",
  AVATAR = "avatar",
  GESTURES = "gestures",
  TRANSLATION = "translation",
  TTS = "tts",
}

/**
 * The participant's own settings. The session and participant ids are NOT in
 * the body: they come from the participant token, so a caller cannot address
 * another participant's record.
 */
export class CreatePreferenceDto {
  @ApiProperty({
    description: "Accessibility channels this participant needs",
    enum: AccessibilityChannel,
    isArray: true,
    example: [AccessibilityChannel.CAPTIONS, AccessibilityChannel.AVATAR],
  })
  @IsArray()
  @IsEnum(AccessibilityChannel, { each: true })
  channels: AccessibilityChannel[];

  @ApiPropertyOptional({ description: "Language for captions", example: "en" })
  @IsString()
  @IsOptional()
  captionLanguage?: string;

  @ApiPropertyOptional({
    description: "Target language for translation",
    example: "es",
  })
  @IsString()
  @IsOptional()
  translationTargetLanguage?: string;

  @ApiPropertyOptional({
    description: "Sign language (ASL only for MVP)",
    example: "ASL",
    default: "ASL",
  })
  @IsString()
  @IsOptional()
  signLanguage?: string;
}
