import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { investorOpportunities } from "../../db/schema";
import { logger } from "../../utils/logger";
import { users } from "../../db/schema";
import { investorOpportunityBookmarks } from "../../db/schema";
function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}
function mapRow(r) {
    return {
        id: r.id,
        name: r.name,
        countryOfOrigin: r.countryOfOrigin ?? null,
        totalFundSize: r.totalFundSize ?? null,
        sectorFocusSsa: r.sectorFocusSsa ?? null,
        countriesOfOperation: r.countriesOfOperation ?? null,
        operatingSince: r.operatingSince ?? null,
        website: r.website ?? null,
        isActive: r.isActive,
        createdAt: r.createdAt?.toISOString?.() ?? null,
        updatedAt: r.updatedAt?.toISOString?.() ?? null,
    };
}
export class InvestorOpportunitiesService {
    static async create(clerkId, body) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const values = {
                name: body.name,
                countryOfOrigin: body.countryOfOrigin ?? null,
                totalFundSize: body.totalFundSize ?? null,
                sectorFocusSsa: body.sectorFocusSsa ?? null,
                countriesOfOperation: body.countriesOfOperation ?? null,
                operatingSince: body.operatingSince ?? null,
                website: body.website ?? null,
                isActive: body.isActive ?? true,
            };
            const [row] = await db
                .insert(investorOpportunities)
                .values(values)
                .returning();
            return mapRow(row);
        }
        catch (error) {
            logger.error("Error creating investor opportunity:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[CREATE_INVESTOR_OPPORTUNITY_ERROR] Failed to create investor opportunity");
        }
    }
    static async list(clerkId) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const rows = await db
                .select()
                .from(investorOpportunities)
                .where(isNull(investorOpportunities.deletedAt));
            return {
                success: true,
                message: "Investor opportunities retrieved successfully",
                data: rows.map(mapRow),
            };
        }
        catch (error) {
            logger.error("Error listing investor opportunities:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[LIST_INVESTOR_OPPORTUNITIES_ERROR] Failed to list investor opportunities");
        }
    }
    static async getById(clerkId, id) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const [row] = await db
                .select()
                .from(investorOpportunities)
                .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)))
                .limit(1);
            if (!row)
                throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");
            return mapRow(row);
        }
        catch (error) {
            logger.error("Error getting investor opportunity:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[GET_INVESTOR_OPPORTUNITY_ERROR] Failed to get investor opportunity");
        }
    }
    static async update(clerkId, id, body) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const [existing] = await db
                .select({ id: investorOpportunities.id })
                .from(investorOpportunities)
                .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)));
            if (!existing)
                throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");
            const [row] = await db
                .update(investorOpportunities)
                .set({
                name: body.name ?? undefined,
                countryOfOrigin: body.countryOfOrigin ?? undefined,
                totalFundSize: body.totalFundSize ?? undefined,
                sectorFocusSsa: body.sectorFocusSsa ?? undefined,
                countriesOfOperation: body.countriesOfOperation ?? undefined,
                operatingSince: body.operatingSince ?? undefined,
                website: body.website ?? undefined,
                isActive: body.isActive ?? undefined,
                updatedAt: new Date(),
            })
                .where(eq(investorOpportunities.id, id))
                .returning();
            return mapRow(row);
        }
        catch (error) {
            logger.error("Error updating investor opportunity:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[UPDATE_INVESTOR_OPPORTUNITY_ERROR] Failed to update investor opportunity");
        }
    }
    static async remove(clerkId, id) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const [existing] = await db
                .select({ id: investorOpportunities.id })
                .from(investorOpportunities)
                .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)));
            if (!existing)
                throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");
            await db
                .update(investorOpportunities)
                .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
                .where(eq(investorOpportunities.id, id));
            return { success: true, message: "Investor opportunity deleted successfully" };
        }
        catch (error) {
            logger.error("Error deleting investor opportunity:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[DELETE_INVESTOR_OPPORTUNITY_ERROR] Failed to delete investor opportunity");
        }
    }
    // ------------------------------------------------------------
    // Bookmarks
    // ------------------------------------------------------------
    static async bookmark(clerkId, id) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            // Resolve internal user id
            const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
            if (!user)
                throw httpError(404, "[USER_NOT_FOUND] User not found");
            // Ensure opportunity exists and not deleted
            const [existing] = await db
                .select({ id: investorOpportunities.id })
                .from(investorOpportunities)
                .where(and(eq(investorOpportunities.id, id), isNull(investorOpportunities.deletedAt)))
                .limit(1);
            if (!existing)
                throw httpError(404, "[INVESTOR_OPPORTUNITY_NOT_FOUND] Investor opportunity not found");
            // Insert bookmark (idempotent via unique index)
            await db
                .insert(investorOpportunityBookmarks)
                .values({ userId: user.id, opportunityId: id })
                .onConflictDoNothing();
            return { success: true, message: "Bookmarked successfully" };
        }
        catch (error) {
            logger.error("Error bookmarking investor opportunity:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[BOOKMARK_ERROR] Failed to bookmark investor opportunity");
        }
    }
    static async unbookmark(clerkId, id) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
            if (!user)
                throw httpError(404, "[USER_NOT_FOUND] User not found");
            await db
                .delete(investorOpportunityBookmarks)
                .where(and(eq(investorOpportunityBookmarks.userId, user.id), eq(investorOpportunityBookmarks.opportunityId, id)));
            return { success: true, message: "Unbookmarked successfully" };
        }
        catch (error) {
            logger.error("Error unbookmarking investor opportunity:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[UNBOOKMARK_ERROR] Failed to unbookmark investor opportunity");
        }
    }
    static async listBookmarks(clerkId) {
        try {
            if (!clerkId)
                throw httpError(401, "[UNAUTHORIZED] Missing user context");
            const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
            if (!user)
                throw httpError(404, "[USER_NOT_FOUND] User not found");
            // Join bookmarks -> opportunities and filter out deleted
            const rows = await db
                .select()
                .from(investorOpportunities)
                .innerJoin(investorOpportunityBookmarks, eq(investorOpportunityBookmarks.opportunityId, investorOpportunities.id))
                .where(and(eq(investorOpportunityBookmarks.userId, user.id), isNull(investorOpportunities.deletedAt)));
            // rows is array of { investor_opportunities: ..., investor_opportunity_bookmarks: ... }
            const items = rows.map((r) => mapRow(r.investor_opportunities ?? r.investorOpportunities ?? r["investor_opportunities"] ?? r["investorOpportunities"]));
            return { success: true, message: "Bookmarked investor opportunities retrieved successfully", data: items };
        }
        catch (error) {
            logger.error("Error listing bookmarked investor opportunities:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[LIST_BOOKMARKS_ERROR] Failed to list bookmarked investor opportunities");
        }
    }
}
