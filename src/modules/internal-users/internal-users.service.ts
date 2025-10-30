import { clerkClient } from "@clerk/fastify";
import { db } from "../../db";
import { internalInvitations, internalInvitationStatusEnum, users } from "../../db/schema";
import { eq } from "drizzle-orm";
import type { InternalUsersModel } from "./internal-users.model";

export class InternalUsersService {
  static async requireSuperAdminOrThrow(clerkUserId: string) {
    const current = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUserId) });
    if (!current || current.role !== 'super-admin') {
      const err: any = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
    return current;
  }

  static async createInvitation(params: { invitedByClerkUserId: string; body: InternalUsersModel.CreateInvitationBody }): Promise<InternalUsersModel.CreateInvitationResponse> {
    const { body, invitedByClerkUserId } = params;

    await InternalUsersService.requireSuperAdminOrThrow(invitedByClerkUserId);

    const redirectUrl = `${process.env.APP_URL?.replace(/\/$/, '') || ''}/internal/accept-invite`;

    const invitation = await clerkClient.invitations.createInvitation({
      emailAddress: body.email,
      publicMetadata: { role: body.role, internal: true },
      redirectUrl,
    } as any);

    const now = new Date();
    await db.insert(internalInvitations).values({
      email: body.email,
      role: body.role,
      clerkInvitationId: (invitation as any).id,
      status: 'pending' as typeof internalInvitationStatusEnum.enumValues[number],
      invitedByUserId: invitedByClerkUserId,
      lastSentAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, invitationId: (invitation as any).id };
  }

  static async listInternalUsers(): Promise<InternalUsersModel.ListUsersResponse> {
    // Pending invitations
    const invites = await db.query.internalInvitations.findMany({});

    // Existing local users with a role (internal)
    const localUsers = await db.query.users.findMany({});

    const items: InternalUsersModel.ListedUserItem[] = [];

    // Map pending invites
    for (const inv of invites) {
      items.push({
        name: inv.email,
        email: inv.email,
        status: 'pending',
        invitationId: inv.clerkInvitationId || inv.id,
        role: inv.role as any,
      });
    }

    // Map active/inactive users using Clerk status
    for (const u of localUsers) {
      if (!u.role) continue;
      try {
        const cu = await clerkClient.users.getUser(u.clerkId);
        const inactive = (cu?.banned === true);
        items.push({
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
          imageUrl: u.imageUrl || undefined,
          phoneNumber: u.phoneNumber || undefined,
          email: u.email,
          role: u.role as any,
          status: inactive ? 'inactive' : 'active',
          clerkId: u.clerkId,
        });
      } catch {
        // If Clerk lookup fails, consider inactive as safe fallback
        items.push({
          name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
          imageUrl: u.imageUrl || undefined,
          phoneNumber: u.phoneNumber || undefined,
          email: u.email,
          role: u.role as any,
          status: 'inactive',
          clerkId: u.clerkId,
        });
      }
    }

    // Deduplicate by email preferring active/inactive over pending
    const byEmail = new Map<string, InternalUsersModel.ListedUserItem>();
    for (const it of items) {
      const existing = byEmail.get(it.email);
      if (!existing) { byEmail.set(it.email, it); continue; }
      const rank = (s: any) => s === 'active' ? 2 : s === 'inactive' ? 1 : 0;
      if (rank(it.status) > rank(existing.status)) byEmail.set(it.email, it);
    }

    return { items: [...byEmail.values()] };
  }

  static async resendInvitation(params: { localInvitationId: string }): Promise<InternalUsersModel.BasicSuccessResponse> {
    const inv = await db.query.internalInvitations.findFirst({ where: eq(internalInvitations.id, params.localInvitationId) });
    if (!inv) {
      const err: any = new Error('Invitation not found');
      err.status = 404;
      throw err;
    }
    // Create a fresh Clerk invitation; webhook will handle the email sending
    const redirectUrl = `${process.env.APP_URL?.replace(/\/$/, '') || ''}/internal/accept-invite`;
    await clerkClient.invitations.createInvitation({
      emailAddress: inv.email,
      publicMetadata: { role: inv.role, internal: true },
      redirectUrl,
    } as any);
    await db.update(internalInvitations).set({ lastSentAt: new Date(), updatedAt: new Date() }).where(eq(internalInvitations.id, inv.id));
    return { success: true };
  }

  static async revokeInvitation(params: { localInvitationId: string }): Promise<InternalUsersModel.BasicSuccessResponse> {
    const inv = await db.query.internalInvitations.findFirst({ where: eq(internalInvitations.id, params.localInvitationId) });
    if (!inv || !inv.clerkInvitationId) {
      const err: any = new Error('Invitation not found');
      err.status = 404;
      throw err;
    }
    // Revoke via Clerk
    await clerkClient.invitations.revokeInvitation(inv.clerkInvitationId as any);
    await db.update(internalInvitations).set({ status: 'revoked' as any, updatedAt: new Date() }).where(eq(internalInvitations.id, inv.id));
    return { success: true };
  }

  static async deactivateUser(params: { clerkUserId: string }): Promise<InternalUsersModel.BasicSuccessResponse> {
    await clerkClient.users.updateUser(params.clerkUserId, { banned: true } as any);
    try {
      const sessions = await clerkClient.sessions.getSessionList({ userId: params.clerkUserId } as any);
      for (const s of (sessions as any)?.data || []) {
        await clerkClient.sessions.revokeSession(s.id);
      }
    } catch {}
    return { success: true };
  }

  static async removeUser(params: { clerkUserId: string }): Promise<InternalUsersModel.BasicSuccessResponse> {
    await clerkClient.users.deleteUser(params.clerkUserId);
    try {
      const u = await db.query.users.findFirst({ where: eq(users.clerkId, params.clerkUserId) });
      if (u) {
        await db.update(users).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, u.id));
      }
    } catch {}
    return { success: true };
  }
}


