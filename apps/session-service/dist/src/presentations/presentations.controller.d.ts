import { PresentationsService } from './presentations.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { Request } from 'express';
import { Presentation } from '@prisma/client';
export declare class PresentationsController {
    private readonly presentationsService;
    constructor(presentationsService: PresentationsService);
    create(createPresentationDto: CreatePresentationDto, req: Request): Promise<Presentation>;
}
