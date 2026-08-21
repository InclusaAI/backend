import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from '@prisma/client';
export declare class OrganizationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createOrganizationDto: CreateOrganizationDto, userId: string): Promise<Organization>;
}
