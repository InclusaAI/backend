import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";
import { CommunicationMode } from "../../prisma/client";

export class CreateSessionDto {
  @ApiProperty({
    enum: CommunicationMode,
    example: CommunicationMode.HYBRID,
    description: "The communication mode for the session.",
  })
  @IsEnum(CommunicationMode)
  @IsNotEmpty()
  communicationMode: CommunicationMode;
}
