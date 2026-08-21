import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { Request } from 'express';
import { Session } from '@prisma/client';
export declare class SessionsController {
    private readonly sessionsService;
    constructor(sessionsService: SessionsService);
    start(presentationId: string, createSessionDto: CreateSessionDto, req: Request): Promise<Session>;
    end(sessionId: string, req: Request): Promise<Session>;
}
