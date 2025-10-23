import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { loanApplications } from "../../db/schema/loanApplications";
import { users } from "../../db/schema/users";
import { offerLetters } from "../../db/schema/offerLetters";
import { AuditTrailService } from "../audit-trail/audit-trail.service";
import { SnapshotService } from "../snapshots/snapshot.service";
import { NotificationService } from "../notifications/notification.service";
import { OfferLettersService } from "../offer-letters/offer-letters.service";
import { logger } from "../../utils/logger";

// Simple in-memory cache for user lookups (5 minute TTL)
const userCache = new Map<string, { user: any; expires: number }>();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Loan application status enum
export type LoanApplicationStatus = 
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "offer_letter_sent"
  | "offer_letter_signed"
  | "offer_letter_declined"
  | "rejected"
  | "withdrawn"
  | "disbursed"
  | "expired";

// Status transition rules
const STATUS_TRANSITIONS: Record<LoanApplicationStatus, LoanApplicationStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["approved", "rejected", "withdrawn"],
  approved: ["offer_letter_sent", "disbursed", "withdrawn"], // Can send offer letter or go directly to disbursement
  offer_letter_sent: ["offer_letter_signed", "offer_letter_declined", "withdrawn"],
  offer_letter_signed: ["disbursed", "withdrawn"],
  offer_letter_declined: ["approved", "rejected", "withdrawn"], // Can resend offer or reject
  rejected: ["submitted", "withdrawn"], // Allow resubmission
  withdrawn: [], // Terminal state
  disbursed: [], // Terminal state
  expired: [], // Terminal state
};

// Interfaces for service parameters and responses
export interface UpdateStatusParams {
  loanApplicationId: string;
  newStatus: LoanApplicationStatus;
  userId: string;
  reason?: string;
  rejectionReason?: string;
  metadata?: Record<string, any>;
}

export interface StatusValidationResult {
  isValid: boolean;
  error?: string;
  allowedTransitions?: LoanApplicationStatus[];
}

export interface StatusUpdateResult {
  success: boolean;
  previousStatus: LoanApplicationStatus;
  newStatus: LoanApplicationStatus;
  message: string;
  snapshotCreated?: boolean;
  auditEntryId?: string;
}

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class StatusService {
  /**
   * Validates if a status transition is allowed
   */
  static validateStatusTransition(
    currentStatus: LoanApplicationStatus,
    newStatus: LoanApplicationStatus
  ): StatusValidationResult {
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
    
    if (!allowedTransitions) {
      return {
        isValid: false,
        error: `Invalid current status: ${currentStatus}`,
      };
    }

    if (!allowedTransitions.includes(newStatus)) {
      return {
        isValid: false,
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
        allowedTransitions,
      };
    }

    return {
      isValid: true,
      allowedTransitions,
    };
  }

  /**
   * Updates the status of a loan application with full audit trail
   */
  static async updateStatus(params: UpdateStatusParams): Promise<StatusUpdateResult> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      const { loanApplicationId, newStatus, userId, reason, rejectionReason, metadata } = params;

      logger.info(`[STATUS_UPDATE_START] RequestID: ${requestId} | Loan: ${loanApplicationId} | Status: ${newStatus} | User: ${userId} | Time: ${new Date().toISOString()}`);

      // Basic validation
      if (!loanApplicationId || !newStatus || !userId) {
        throw httpError(400, "[BAD_REQUEST] Missing required status update parameters.");
      }

      // Get current loan application
      const [currentApplication] = await db
        .select()
        .from(loanApplications)
        .where(
          and(
            eq(loanApplications.id, loanApplicationId),
            isNull(loanApplications.deletedAt)
          )
        )
        .limit(1);

      if (!currentApplication) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found.");
      }

      logger.info(`[STATUS_UPDATE_CURRENT] RequestID: ${requestId} | Current Status: ${currentApplication.status} -> New Status: ${newStatus}`);

      // Validate status transition
      const validation = StatusService.validateStatusTransition(
        currentApplication.status as LoanApplicationStatus,
        newStatus
      );

      if (!validation.isValid) {
        throw httpError(400, `[INVALID_STATUS_TRANSITION] ${validation.error}`);
      }
      logger.info(`Validating status transition for loan application ${loanApplicationId} from ${currentApplication.status} to ${newStatus} for user ${userId}`);
      
      // Get user for audit trail (with caching)
      let user;
      const cached = userCache.get(userId);
      if (cached && cached.expires > Date.now()) {
        user = cached.user;
      } else {
        user = await db.query.users.findFirst({
          where: eq(users.clerkId, userId),
        });
        if (!user) {
          throw httpError(404, "[USER_NOT_FOUND] User not found for status update.");
        }
        // Cache the user for 5 minutes
        userCache.set(userId, { user, expires: Date.now() + USER_CACHE_TTL });
      }

      // Prepare update data
      const updateData: Record<string, any> = {
        status: newStatus,
        statusReason: reason || `Status updated to ${newStatus}`,
        lastUpdatedBy: userId,
        lastUpdatedAt: new Date(),
        updatedAt: new Date(),
      };

      // Set appropriate timestamp based on status
      switch (newStatus) {
        case "under_review":
          updateData.reviewedAt = new Date();
          break;
        case "approved":
          updateData.approvedAt = new Date();
          break;
        case "disbursed":
          updateData.disbursedAt = new Date();
          break;
        case "rejected":
          updateData.rejectedAt = new Date();
          if (rejectionReason) {
            updateData.rejectionReason = rejectionReason;
          }
          break;
      }

      logger.info(`[STATUS_UPDATE_TRANSACTION_START] RequestID: ${requestId} | Starting database transaction`);

      // Wrap all database operations in a transaction
      const result = await db.transaction(async (tx) => {
        // Update the loan application
        await tx
          .update(loanApplications)
          .set(updateData)
          .where(eq(loanApplications.id, loanApplicationId));

        // Log status update to audit trail
        const auditEntry = await AuditTrailService.logAction({
          loanApplicationId,
          userId: user.id,
          action: `application_${newStatus}` as any,
          reason: reason || `Application status updated to ${newStatus}`,
          details: rejectionReason || `Status changed from ${currentApplication.status} to ${newStatus}`,
          beforeData: { 
            status: currentApplication.status,
            statusReason: currentApplication.statusReason,
          },
          afterData: { 
            status: newStatus,
            statusReason: updateData.statusReason,
            ...updateData,
          },
          metadata: {
            previousStatus: currentApplication.status,
            newStatus,
            rejectionReason,
            ...metadata,
          },
        });

        let snapshotCreated = false;

        // Create snapshot when application is approved
        if (newStatus === "approved") {
          await SnapshotService.createSnapshot({
            loanApplicationId,
            createdBy: user.id,
            approvalStage: "loan_approved",
            existingApplication: currentApplication, // Pass existing data
          });

          // Log snapshot creation
          await AuditTrailService.logAction({
            loanApplicationId,
            userId: user.id,
            action: "snapshot_created",
            reason: "Immutable snapshot created at loan approval",
            details: "Complete application state captured for audit trail",
            metadata: {
              approvalStage: "loan_approved",
              triggeredBy: "status_update",
            },
          });

          snapshotCreated = true;
        }

        // Create offer letter when status changes to offer_letter_sent
        if (newStatus === "offer_letter_sent") {
          logger.info(`[OFFER_LETTER_CHECK] RequestID: ${requestId} | Checking for existing offer letter`);
          
          // Check if offer letter already exists to avoid duplicates
          const existingOffer = await db.query.offerLetters.findFirst({
            where: and(
              eq(offerLetters.loanApplicationId, loanApplicationId),
              eq(offerLetters.isActive, true),
              isNull(offerLetters.deletedAt)
            ),
          });

          if (!existingOffer) {
            logger.info(`[OFFER_LETTER_CREATE] RequestID: ${requestId} | No existing offer letter found, creating new one`);
            // Get loan application details for offer letter creation (optimized query)
            const loanApp = await db.query.loanApplications.findFirst({
              where: eq(loanApplications.id, loanApplicationId),
              with: {
                business: true,
                user: {
                  columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  }
                },
                loanProduct: {
                  columns: {
                    id: true,
                    interestRate: true,
                  }
                },
              },
            });

            if (loanApp) {
              // Create offer letter with basic details
              logger.info(`[OFFER_LETTER_CREATE_START] RequestID: ${requestId} | Creating offer letter for ${loanApp.user.email}`);
              
              const createdOffer = await OfferLettersService.create(userId, {
                loanApplicationId,
                recipientEmail: loanApp.user.email,
                recipientName: `${loanApp.user.firstName} ${loanApp.user.lastName}`,
                offerAmount: Number(loanApp.loanAmount),
                offerTerm: loanApp.loanTerm,
                interestRate: Number(loanApp.loanProduct.interestRate),
                currency: loanApp.currency,
                specialConditions: undefined,
                requiresGuarantor: false,
                requiresCollateral: false,
                expiresAt: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                ).toISOString(), // 30 days from now
              });

              logger.info(`[OFFER_LETTER_SEND_ASYNC] RequestID: ${requestId} | Queuing offer letter ${createdOffer.data.id} for DocuSign sending`);

              // Send the offer letter via DocuSign asynchronously (don't wait)
              setImmediate(async () => {
                try {
                  logger.info(`[OFFER_LETTER_SEND_START] Background | Sending offer letter ${createdOffer.data.id} via DocuSign`);
                  
                  await OfferLettersService.sendOfferLetter(userId, createdOffer.data.id, {
                    docuSignTemplateId: createdOffer.data.docuSignTemplateId || "",
                    recipientEmail: loanApp.user.email,
                    recipientName: `${loanApp.user.firstName} ${loanApp.user.lastName}`,
                  });

                  logger.info("[OFFER_LETTER_SEND_COMPLETE] Background | Offer letter sent successfully via DocuSign");
                } catch (error) {
                  logger.error(`[OFFER_LETTER_SEND_ERROR] Background | Failed to send offer letter ${createdOffer.data.id}:`, error);
                  // Could add retry logic or notification here
                }
              });

              // Log offer letter creation and sending
              await AuditTrailService.logAction({
                loanApplicationId,
                userId: user.id,
                action: "offer_letter_created",
                reason: "Offer letter automatically created and sent when status changed to offer_letter_sent",
                details: "Automated offer letter creation and DocuSign sending triggered by status update",
                metadata: {
                  triggeredBy: "status_update",
                  newStatus: "offer_letter_sent",
                  offerLetterId: createdOffer.data.id,
                },
              });
            }
          } else {
            logger.info(`[OFFER_LETTER_SKIP] RequestID: ${requestId} | Offer letter already exists for loan application ${loanApplicationId}, skipping creation`);
          }
        }

        return { auditEntry, snapshotCreated };
      });

      const { auditEntry, snapshotCreated } = result;

      logger.info(`[STATUS_UPDATE_TRANSACTION_COMPLETE] RequestID: ${requestId} | Database transaction completed successfully`);

      // Send notification to the loan applicant
      try {
        const applicantId = currentApplication.userId;
        await NotificationService.sendStatusUpdateNotification(
          loanApplicationId,
          applicantId,
          {
            previousStatus: currentApplication.status as LoanApplicationStatus,
            newStatus,
            reason,
            rejectionReason,
          },
          ['email'] // Send email notification
        );
      } catch (error) {
        logger.error("Failed to send status update notification:", error);
        // Don't fail the status update if notification fails
      }

      logger.info(`[STATUS_UPDATE_SUCCESS] RequestID: ${requestId} | Status update completed successfully | Duration: ${Date.now() - Number.parseInt(requestId.split('-')[0])}ms`);

      return {
        success: true,
        previousStatus: currentApplication.status as LoanApplicationStatus,
        newStatus,
        message: `Status successfully updated from ${currentApplication.status} to ${newStatus}`,
        snapshotCreated,
        auditEntryId: auditEntry.id,
      };
    } catch (error: any) {
      logger.error(`[STATUS_UPDATE_ERROR] RequestID: ${requestId} | Error updating loan application status:`, error);
      if (error.status) throw error;
      throw httpError(500, "[STATUS_UPDATE_ERROR] Failed to update loan application status.");
    }
  }

  /**
   * Gets the current status of a loan application
   */
  static async getStatus(loanApplicationId: string): Promise<{
    status: LoanApplicationStatus;
    statusReason: string | null;
    lastUpdatedBy: string | null;
    lastUpdatedAt: Date | null;
    allowedTransitions: LoanApplicationStatus[];
  }> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[BAD_REQUEST] Loan application ID is required.");
      }

      const [application] = await db
        .select({
          status: loanApplications.status,
          statusReason: loanApplications.statusReason,
          lastUpdatedBy: loanApplications.lastUpdatedBy,
          lastUpdatedAt: loanApplications.lastUpdatedAt,
        })
        .from(loanApplications)
        .where(
          and(
            eq(loanApplications.id, loanApplicationId),
            isNull(loanApplications.deletedAt)
          )
        )
        .limit(1);

      if (!application) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found.");
      }

      const allowedTransitions = STATUS_TRANSITIONS[application.status as LoanApplicationStatus] || [];

      return {
        status: application.status as LoanApplicationStatus,
        statusReason: application.statusReason,
        lastUpdatedBy: application.lastUpdatedBy,
        lastUpdatedAt: application.lastUpdatedAt,
        allowedTransitions,
      };
    } catch (error: any) {
      logger.error("Error getting loan application status:", error);
      if (error.status) throw error;
      throw httpError(500, "[GET_STATUS_ERROR] Failed to get loan application status.");
    }
  }

  /**
   * Gets all possible status transitions for a given status
   */
  static getAllowedTransitions(status: LoanApplicationStatus): LoanApplicationStatus[] {
    return STATUS_TRANSITIONS[status] || [];
  }

  /**
   * Checks if a status is terminal (no further transitions allowed)
   */
  static isTerminalStatus(status: LoanApplicationStatus): boolean {
    return STATUS_TRANSITIONS[status]?.length === 0;
  }

  /**
   * Gets all possible statuses
   */
  static getAllStatuses(): LoanApplicationStatus[] {
    return Object.keys(STATUS_TRANSITIONS) as LoanApplicationStatus[];
  }

  /**
   * Gets status transition history for a loan application
   */
  static async getStatusHistory(loanApplicationId: string): Promise<Array<{
    status: string;
    reason: string | null;
    details: string | null;
    userId: string;
    userName: string;
    userEmail: string;
    createdAt: Date;
    metadata: Record<string, any> | null;
  }>> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[BAD_REQUEST] Loan application ID is required.");
      }

      const auditTrail = await AuditTrailService.getAuditTrail({
        loanApplicationId,
        // Get all audit entries, we'll filter for status-related ones
      });

      // Filter for status-related actions
      const statusEntries = auditTrail.filter(entry => entry.action.startsWith("application_"));

      // Get unique user IDs and fetch user data
      const userIds = [...new Set(statusEntries.map(entry => entry.userId))];
      const users = await db.query.users.findMany({
        where: (users, { inArray }) => inArray(users.id, userIds),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      // Create a user lookup map
      const userMap = new Map(users.map(user => [user.id, user]));

      // Format the response
      return statusEntries.map(entry => {
        const user = userMap.get(entry.userId);
        return {
          status: entry.action.replace("application_", ""),
          reason: entry.reason || null,
          details: entry.details || null,
          userId: entry.userId,
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User" : "Unknown User",
          userEmail: user?.email || "unknown@example.com",
          createdAt: new Date(entry.createdAt),
          metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
        };
      });
    } catch (error: any) {
      logger.error("Error getting status history:", error);
      if (error.status) throw error;
      throw httpError(500, "[GET_STATUS_HISTORY_ERROR] Failed to get status history.");
    }
  }
}
