import { db } from "../../db";
import { users } from "../../db/schema/users";
import { personalDocuments } from "../../db/schema/personalDocuments";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { logger } from "../../utils/logger";
// Lightweight HTTP error helper compatible with our route error handling
function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}
export class Documents {
    /**
     * Upsert personal documents for the current user. If a document with the same
     * docType already exists (active record), it will be replaced (updated).
     * Accepts either a single document or an array of documents.
     */
    static async upsert(clerkId, input) {
        try {
            // Resolve internal user by clerkId
            const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
            if (!user) {
                throw httpError(404, "[USER_NOT_FOUND] User not found");
            }
            // Normalize to array and dedupe by docType (last one wins)
            const docsArray = Array.isArray(input) ? input : [input];
            const byType = new Map();
            for (const d of docsArray) {
                byType.set(d.docType, d.docUrl);
            }
            const upserts = Array.from(byType.entries()).map(([docType, docUrl]) => ({ docType, docUrl }));
            await db.transaction(async (tx) => {
                // Find existing active documents for these types
                const existing = await tx.query.personalDocuments.findMany({
                    where: and(eq(personalDocuments.userId, user.id), inArray(personalDocuments.docType, upserts.map((d) => d.docType)), isNull(personalDocuments.deletedAt)),
                    columns: { id: true, docType: true },
                });
                const existingTypes = new Set(existing.map((e) => e.docType));
                const toUpdate = upserts.filter((d) => existingTypes.has(d.docType));
                const toInsert = upserts.filter((d) => !existingTypes.has(d.docType));
                // Perform updates per type
                for (const d of toUpdate) {
                    await tx
                        .update(personalDocuments)
                        .set({ docUrl: d.docUrl, updatedAt: new Date() })
                        .where(and(eq(personalDocuments.userId, user.id), eq(personalDocuments.docType, d.docType), isNull(personalDocuments.deletedAt)));
                }
                // Perform bulk insert for new types
                if (toInsert.length > 0) {
                    await tx.insert(personalDocuments).values(toInsert.map((d) => ({
                        userId: user.id,
                        docType: d.docType,
                        docUrl: d.docUrl,
                    })));
                }
            });
            return { success: true, message: "Documents upserted successfully" };
        }
        catch (error) {
            logger.error("Error upserting documents:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[UPSERT_DOCUMENTS_ERROR] Failed to upsert documents");
        }
    }
    /**
     * List all active personal documents for the current user
     */
    static async list(clerkId) {
        try {
            const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
            if (!user) {
                throw httpError(404, "[USER_NOT_FOUND] User not found");
            }
            const docs = await db.query.personalDocuments.findMany({
                where: and(eq(personalDocuments.userId, user.id), isNull(personalDocuments.deletedAt)),
                columns: {
                    docType: true,
                    docUrl: true,
                },
            });
            return {
                success: true,
                message: "Documents retrieved successfully",
                data: docs,
            };
        }
        catch (error) {
            logger.error("Error listing documents:", error);
            if (error?.status)
                throw error;
            throw httpError(500, "[LIST_DOCUMENTS_ERROR] Failed to list documents");
        }
    }
}
