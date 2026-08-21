import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { Presentation } from '@prisma/client';

@Injectable()
export class PresentationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createPresentationDto: CreatePresentationDto,
    userId: string,
  ): Promise<Presentation> {
    const { name, slideMetadata, organizationId } = createPresentationDto;

    // Note: In a real application, we would validate that the user (ownerId)
    // is a member of the organization (organizationId). This would require
    // a call to the identity-service or access to a shared user/org database.
    // For now, we trust the ID provided by the authenticated token.

    return this.prisma.presentation.create({
      data: {
        name,
        slideMetadata: slideMetadata as any, // Prisma expects a JsonValue
        organizationId,
        ownerId: userId,
      },
    });
  }
}