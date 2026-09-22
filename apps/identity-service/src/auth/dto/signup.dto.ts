import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class SignUpDto {
  @ApiProperty({
    example: "test@example.com",
    description: "User email address",
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: "password123",
    description: "User password (at least 8 characters)",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    example: "John Doe",
    description: "User full name",
    required: false,
  })
  // @IsOptional() is required for a genuinely optional field: without it
  // class-validator rejects a payload that omits `name`, contradicting both
  // the `required: false` in the OpenAPI schema and the optional TS type.
  @IsOptional()
  @IsString()
  name?: string;
}
