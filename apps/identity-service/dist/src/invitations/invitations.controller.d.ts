import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Request } from 'express';
export declare class InvitationsController {
    private readonly invitationsService;
    constructor(invitationsService: InvitationsService);
    create(createInvitationDto: CreateInvitationDto, req: Request): Promise<{
        message: string;
        invitationId: any;
    }>;
}
