import { and, eq, inArray, isNull, count } from "drizzle-orm";
import { db } from "../../db";
import { userGroups, userGroupMembers, users } from "../../db/schema";
import type { UserGroupsModel } from "./user-groups.model";
import { logger } from "../../utils/logger";
import { ResponseCachingService } from "../response-caching/response-caching.service";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

type GroupRow = typeof userGroups.$inferSelect;

function mapRow(r: GroupRow): UserGroupsModel.GroupItem {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    updatedAt: r.updatedAt?.toISOString?.() ?? null,
  };
}

export abstract class UserGroupsService {
  static async create(
    clerkId: string,
    body: UserGroupsModel.CreateGroupBody,
  ): Promise<UserGroupsModel.GroupItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");
      if (!body.name) throw httpError(400, "[INVALID_INPUT] name is required");

      // Generate slug if missing and ensure uniqueness
      let desiredSlug = body.slug?.trim() || slugify(body.name);
      if (!desiredSlug) desiredSlug = slugify(`${body.name}-${Date.now()}`);

      // Ensure unique slug (append suffix if needed)
      let finalSlug = desiredSlug;
      let attempt = 0;
      // Simple loop for uniqueness check (few iterations expected)
      // Note: considering soft deletes still reserving slug uniqueness
      while (true) {
        const [existing] = await db
          .select({ id: userGroups.id })
          .from(userGroups)
          .where(eq(userGroups.slug, finalSlug))
          .limit(1);
        if (!existing) break;
        attempt += 1;
        finalSlug = `${desiredSlug}-${attempt}`;
      }

      const [group] = await db
        .insert(userGroups)
        .values({
          name: body.name,
          slug: finalSlug,
          description: body.description ?? null,
        })
        .returning();

      // Membership handling (optional at creation)
      if (body.userIds && body.userIds.length > 0) {
        const uniqueUserIds = Array.from(new Set(body.userIds));
        const found = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, uniqueUserIds));
        const validIds = new Set(found.map((u) => u.id));
        const rows = uniqueUserIds
          .filter((id) => validIds.has(id))
          .map((id) => ({ userId: id, groupId: group.id }));
        if (rows.length) {
          await db.insert(userGroupMembers).values(rows).onConflictDoNothing();
          // Invalidate members cache for this group
          await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${group.id}/members*`);
        }
      }

      return mapRow(group);
    } catch (error: any) {
      logger.error("Error creating user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_USER_GROUP_ERROR] Failed to create group");
    }
  }

  static async list(): Promise<{ success: boolean; message: string; data: UserGroupsModel.GroupItem[] }> {
    try {
      const rows = await db
        .select()
        .from(userGroups)
        .where(isNull(userGroups.deletedAt));
      return { success: true, message: "Groups retrieved successfully", data: rows.map(mapRow) };
    } catch (error: any) {
      logger.error("Error listing user groups:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_USER_GROUPS_ERROR] Failed to list groups");
    }
  }

  static async getById(id: string): Promise<UserGroupsModel.GroupItem> {
    try {
      const [row] = await db
        .select()
        .from(userGroups)
        .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
        .limit(1);
      if (!row) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");
      return mapRow(row);
    } catch (error: any) {
      logger.error("Error getting user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_USER_GROUP_ERROR] Failed to get group");
    }
  }

  static async update(
    clerkId: string,
    id: string,
    body: UserGroupsModel.EditGroupBody,
  ): Promise<UserGroupsModel.GroupItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Prepare slug if provided
      let newSlug: string | undefined;
      if (body.slug) {
        const desiredSlug = slugify(body.slug);
        let finalSlug = desiredSlug;
        let attempt = 0;
        while (true) {
          const [existing] = await db
            .select({ id: userGroups.id })
            .from(userGroups)
            .where(and(eq(userGroups.slug, finalSlug), isNull(userGroups.deletedAt)));
          if (!existing || existing.id === id) break;
          attempt += 1;
          finalSlug = `${desiredSlug}-${attempt}`;
        }
        newSlug = finalSlug;
      }

      const [updated] = await db
        .update(userGroups)
        .set({
          name: body.name ?? undefined,
          slug: newSlug ?? undefined,
          description: body.description ?? undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)))
        .returning();

      if (!updated) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Membership operations
      if (body.userIds && body.userIds.length >= 0) {
        // Replace full membership set
        await db.delete(userGroupMembers).where(eq(userGroupMembers.groupId, id));
        const uniqueUserIds = Array.from(new Set(body.userIds));
        if (uniqueUserIds.length) {
          const found = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, uniqueUserIds));
          const validIds = new Set(found.map((u) => u.id));
          const rows = uniqueUserIds
            .filter((uid) => validIds.has(uid))
            .map((uid) => ({ userId: uid, groupId: id }));
          if (rows.length) await db.insert(userGroupMembers).values(rows).onConflictDoNothing();
        }
        // Invalidate members cache for this group
        await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${id}/members*`);
      } else {
        // Incremental add/remove
        if (body.addUserIds && body.addUserIds.length) {
          const uniqueUserIds = Array.from(new Set(body.addUserIds));
          const found = await db
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, uniqueUserIds));
          const validIds = new Set(found.map((u) => u.id));
          const rows = uniqueUserIds
            .filter((uid) => validIds.has(uid))
            .map((uid) => ({ userId: uid, groupId: id }));
          if (rows.length) await db.insert(userGroupMembers).values(rows).onConflictDoNothing();
        }
        if (body.removeUserIds && body.removeUserIds.length) {
          const uniqueUserIds = Array.from(new Set(body.removeUserIds));
          await db
            .delete(userGroupMembers)
            .where(and(eq(userGroupMembers.groupId, id), inArray(userGroupMembers.userId, uniqueUserIds)));
        }
        // Invalidate members cache for this group
        await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${id}/members*`);
      }

      return mapRow(updated);
    } catch (error: any) {
      logger.error("Error updating user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_USER_GROUP_ERROR] Failed to update group");
    }
  }

  static async remove(
    clerkId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, id), isNull(userGroups.deletedAt)));
      if (!existing) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      await db
        .update(userGroups)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(userGroups.id, id));

      // Invalidate members cache for this group
      await ResponseCachingService.invalidateByPattern(`GET:/user-groups/${id}/members*`);

      return { success: true, message: "Group deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting user group:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_USER_GROUP_ERROR] Failed to delete group");
    }
  }

  static async listMembers(
    groupId: string,
    query: UserGroupsModel.ListGroupMembersQuery = {}
  ): Promise<{ success: boolean; message: string; data: UserGroupsModel.GroupMemberItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      // Ensure group exists (soft-delete aware)
      const [group] = await db
        .select({ id: userGroups.id })
        .from(userGroups)
        .where(and(eq(userGroups.id, groupId), isNull(userGroups.deletedAt)))
        .limit(1);
      if (!group) throw httpError(404, "[USER_GROUP_NOT_FOUND] Group not found");

      // Pagination
      const page = query.page ? Math.max(1, parseInt(query.page)) : 1;
      const limit = Math.min(query.limit ? Math.max(1, parseInt(query.limit)) : 20, 100);
      const offset = (page - 1) * limit;

      const [{ total }] = await db
        .select({ total: count() })
        .from(userGroupMembers)
        .where(eq(userGroupMembers.groupId, groupId));

      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          phoneNumber: users.phoneNumber,
          imageUrl: users.imageUrl,
        })
        .from(userGroupMembers)
        .innerJoin(users, eq(users.id, userGroupMembers.userId))
        .where(eq(userGroupMembers.groupId, groupId))
        .limit(limit)
        .offset(offset);

      const data = rows.map((r) => ({
        id: r.id,
        firstName: r.firstName ?? null,
        lastName: r.lastName ?? null,
        email: r.email ?? null,
        phoneNumber: r.phoneNumber ?? null,
        imageUrl: r.imageUrl ?? null,
      }));

      return {
        success: true,
        message: "Group members retrieved successfully",
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing group members:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_GROUP_MEMBERS_ERROR] Failed to list group members");
    }
  }
}
