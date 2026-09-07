import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional } from 'class-validator';

/**
 * Accessibility channels a participant may need.
 * Matches inclusaai_contracts.events.AccessibilityChannel
 */
export enum AccessibilityChannel {
  CAPTIONS = 'captions',
  AVATAR = 'avatar',
  GESTURES = 'gestures',
  TRANSLATION = 'translation',
  TTS = 'tts',
}

export class CreatePreferenceDto {
  @ApiProperty({ description: 'Session ID (Prisma cuid)', example: 'clx1234567890' })
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @ApiProperty({ description: 'Participant ID', example: 'user-123' })
  @IsString()
  @IsNotEmpty()
  participantId: string;

  @ApiProperty({
    description: 'Accessibility channels this participant needs',
    enum: AccessibilityChannel,
    isArray: true,
    example: [AccessibilityChannel.CAPTIONS, AccessibilityChannel.AVATAR],
  })
  @IsArray()
  @IsEnum(AccessibilityChannel, { each: true })
  channels: AccessibilityChannel[];

  @ApiPropertyOptional({ description: 'Language for captions', example: 'en' })
  @IsString()
  @IsOptional()
  captionLanguage?: string;

  @ApiPropertyOptional({ description: 'Target language for translation', example: 'es' })
  @IsString()
  @IsOptional()
  translationTargetLanguage?: string;

  @ApiPropertyOptional({ description: 'Sign language (ASL only for MVP)', example: 'ASL', default: 'ASL' })
  @IsString()
  @IsOptional()
  signLanguage?: string;
}
