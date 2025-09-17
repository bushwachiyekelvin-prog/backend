import { BusinessModel } from "./business.model";
import { db } from "../../db";
import { businessProfiles } from "../../db/schema/businessProfiles";
import { logger } from "../../utils/logger";
import { users } from "../../db/schema/users";
import { eq } from "drizzle-orm";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class Business {
  /**
   * Register a new business profile for a user
   * @param clerkId Clerk user id, used to resolve internal users.id
   * @param payload Business registration payload
   */
  static async register(
    clerkId: string,
    payload: BusinessModel.RegisterBusinessInput,
  ): Promise<{ id: string }> {
    try {
      if (!clerkId) {
        throw httpError(401, "[UNAUTHORIZED] Missing user context");
      }

      // Resolve internal user id from Clerk id
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      // Map payload to DB schema fields (apply necessary conversions)
      const values = {
        userId: user.id,
        name: payload.name,
        description: payload.description ?? null,
        entityType: payload.entityType,
        country: payload.country,
        yearOfIncorporation: String(payload.yearOfIncorporation),
        isOwned: payload.isOwned,
        ownershipPercentage:
          typeof payload.ownershipPercentage === "number"
            ? Math.round(payload.ownershipPercentage)
            : null,
        ownershipType: payload.ownershipType ?? null,
        sector: payload.sector,
      } as any;

      const created = await db
        .insert(businessProfiles)
        .values(values)
        .returning({ id: businessProfiles.id });

      return { id: created[0].id };
    } catch (error: any) {
      logger.error("Error registering business:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[BUSINESS_REGISTER_ERROR] An error occurred while registering the business",
      );
    }
  }
}

