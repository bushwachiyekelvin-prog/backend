import { db } from "../db";
import { users, personalDocuments, businessProfiles, loanApplicationSnapshots, applicationAuditTrail, documentRequests, investorOpportunityBookmarks, loanApplications, offerLetters } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { logger } from "../utils/logger";
import { CachingService } from "../modules/caching/caching.service";

export class UserDeletionService {
  static async deleteUserAndAllRelatedData(clerkId: string): Promise<void> {
    try {
      logger.info("Starting user deletion process", { clerkId });

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        logger.warn("User not found for deletion", { clerkId });
        return;
      }

      const userId = user.id;
      logger.info("Found user for deletion", { userId, clerkId });

      // Get all loan applications before deletion (needed for cache invalidation)
      const userLoanApplications = await db.query.loanApplications.findMany({
        where: eq(loanApplications.userId, userId),
      });

      // Wrap all deletions in a transaction
      await db.transaction(async (tx) => {

        await tx
          .delete(documentRequests)
          .where(
            or(
              eq(documentRequests.requestedBy, userId),
              eq(documentRequests.requestedFrom, userId)
            )
          );
        logger.info("Deleted document requests", { userId });

        await tx
          .delete(investorOpportunityBookmarks)
          .where(eq(investorOpportunityBookmarks.userId, userId));
        logger.info("Deleted investor opportunity bookmarks", { userId });

        await tx
          .delete(loanApplicationSnapshots)
          .where(eq(loanApplicationSnapshots.createdBy, userId));
        logger.info("Deleted loan application snapshots", { userId });

        await tx
          .delete(applicationAuditTrail)
          .where(eq(applicationAuditTrail.userId, userId));
        logger.info("Deleted audit trail entries", { userId });

        const userLoanApplications = await tx.query.loanApplications.findMany({
          where: eq(loanApplications.userId, userId),
        });

        if (userLoanApplications.length > 0) {
          const loanAppIds = userLoanApplications.map((app) => app.id);
          await tx
            .delete(offerLetters)
            .where(
              or(...loanAppIds.map((id) => eq(offerLetters.loanApplicationId, id)))
            );
          logger.info("Deleted offer letters", { userId });
        }

        await tx
          .delete(loanApplications)
          .where(eq(loanApplications.userId, userId));
        logger.info("Deleted loan applications", { userId });

        await tx
          .delete(businessProfiles)
          .where(eq(businessProfiles.userId, userId));
        logger.info("Deleted business profiles", { userId });

        await tx
          .delete(personalDocuments)
          .where(eq(personalDocuments.userId, userId));
        logger.info("Deleted personal documents", { userId });

        await tx
          .delete(users)
          .where(eq(users.id, userId));
        logger.info("Deleted user record", { userId, clerkId });
      });

      logger.info("User deletion completed successfully", { userId, clerkId, transactionCommitted: true });

      // Invalidate all cache entries for this user and their loan applications
      try {
        logger.info("Invalidating cache for deleted user", { userId, clerkId });
        
        // Invalidate user-specific cache
        await CachingService.invalidateUser(userId);
        
        // Invalidate cache for all loan applications owned by this user
        for (const loanApp of userLoanApplications) {
          await CachingService.invalidateLoanApplication(loanApp.id);
        }
        
        logger.info("Cache invalidation completed for deleted user", { userId, clerkId });
      } catch (cacheError) {
        logger.error("Error invalidating cache after user deletion", {
          userId,
          clerkId,
          error: cacheError instanceof Error ? cacheError.message : cacheError,
        });
        // Don't throw - cache invalidation failure shouldn't prevent user deletion
      }
    } catch (error) {
      logger.error("Error during user deletion process - transaction rolled back", {
        clerkId,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}
