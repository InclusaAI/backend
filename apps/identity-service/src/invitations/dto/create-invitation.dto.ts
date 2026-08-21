import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateInvitationDto {
  @ApiProperty({
    example: 'new.member@example.com',
    description: 'The email of the user to invite',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'cuid_of_the_organization',
    description: 'The ID of the organization to invite the user to',
  })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}