import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { Organization } from "../prisma/client";

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createOrganizationDto: CreateOrganizationDto,
    userId: string,
  ): Promise<Organization> {
    const { name } = createOrganizationDto;

    return this.prisma.organization.create({
      data: {
        name,
        memberships: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
      },
    });
  }
}
