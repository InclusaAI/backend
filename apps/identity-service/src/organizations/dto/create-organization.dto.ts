import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class CreateOrganizationDto {
  @ApiProperty({
    example: "My Awesome Company",
    description: "The name of the organization",
  })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
