export const INVITATION_CREATED_EVENT = 'identity.invitation.created';

export interface InvitationCreatedPayload {
  invitationId: string;
  email: string;
  organizationName: string;
  inviterName: string;
}