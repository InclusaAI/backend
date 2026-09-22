import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsObject, IsArray } from "class-validator";

class SlideDto {
  @ApiProperty({ description: "The order of the slide in the presentation." })
  @IsNotEmpty()
  order: number;

  @ApiProperty({ description: "The placeholder URL for the slide image." })
  @IsString()
  @IsNotEmpty()
  url: string;
}

export class CreatePresentationDto {
  @ApiProperty({
    example: "My Q3 Earnings Report",
    description: "The name of the presentation.",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "Metadata for the slides in the presentation.",
    type: [SlideDto],
  })
  @IsArray()
  slideMetadata: SlideDto[];

  @ApiProperty({
    description: "The ID of the organization this presentation belongs to.",
  })
  @IsString()
  @IsNotEmpty()
  organizationId: string;
}
