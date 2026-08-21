import { PrismaService } from '../prisma/prisma.service';
import { CreatePresentationDto } from './dto/create-presentation.dto';
import { Presentation } from '@prisma/client';
export declare class PresentationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(createPresentationDto: CreatePresentationDto, userId: string): Promise<Presentation>;
}
