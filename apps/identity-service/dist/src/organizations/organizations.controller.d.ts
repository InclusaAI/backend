import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Request } from 'express';
export declare class OrganizationsController {
    private readonly organizationsService;
    constructor(organizationsService: OrganizationsService);
    create(createOrganizationDto: CreateOrganizationDto, req: Request): Promise<Organization>;
}
