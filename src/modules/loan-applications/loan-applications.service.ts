import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import {
  businessProfiles,
  loanApplications,
  loanProducts,
  offerLetters,
  users,
} from "../../db/schema";
import { loanProductSnapshots } from "../../db/schema/loanProductSnapshots";
import { LoanApplicationsModel } from "./loan-applications.model";
import { LoanApplicationsSchemas } from "./loan-applications.schemas";
import { 
  mapLoanApplicationRow, 
  mapOfferLetterRow, 
  generateApplicationNumber,
  toNumber
} from "./loan-applications.mapper";
import { logger } from "../../utils/logger";
import { AuditTrailService } from "../audit-trail/audit-trail.service";
import { SnapshotService } from "../snapshots/snapshot.service";
import { NotificationService } from "../notifications/notification.service";
import { OfferLettersService } from "../offer-letters/offer-letters.service";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}


export abstract class LoanApplicationsService {
  /**
   * Create a new loan application
   */
  static async create(
    clerkId: string,
    body: LoanApplicationsModel.CreateLoanApplicationBody,
  ): Promise<LoanApplicationsModel.CreateLoanApplicationResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Get user by clerkId
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Validate loan product exists
      const [loanProduct] = await db
        .select()
        .from(loanProducts)
        .where(
          and(
            eq(loanProducts.id, body.loanProductId),
            isNull(loanProducts.deletedAt),
          ),
        )
        .limit(1);
      if (!loanProduct)
        throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Validate business exists if provided
      if (body.businessId) {
        const business = await db.query.businessProfiles.findFirst({
          where: and(
            eq(businessProfiles.id, body.businessId),
            isNull(businessProfiles.deletedAt),
          ),
        });
        if (!business)
          throw httpError(404, "[BUSINESS_NOT_FOUND] Business not found");
      }

      // Validate loan amount and term against product constraints
      const minAmount = toNumber(loanProduct.minAmount) ?? 0;
      const maxAmount = toNumber(loanProduct.maxAmount) ?? 0;

      if (body.loanAmount < minAmount || body.loanAmount > maxAmount) {
        throw httpError(
          400,
          `[INVALID_AMOUNT] Loan amount must be between ${minAmount} and ${maxAmount}`,
        );
      }

      if (
        body.loanTerm < loanProduct.minTerm ||
        body.loanTerm > loanProduct.maxTerm
      ) {
        throw httpError(
          400,
          `[INVALID_TERM] Loan term must be between ${loanProduct.minTerm} and ${loanProduct.maxTerm} ${loanProduct.termUnit}`,
        );
      }

      // Validate currency matches product
      if (body.currency !== loanProduct.currency) {
        throw httpError(
          400,
          `[INVALID_CURRENCY] Currency must match loan product currency: ${loanProduct.currency}`,
        );
      }

      const applicationNumber = generateApplicationNumber();

      const values = {
        applicationNumber,
        userId: user.id,
        businessId: body.businessId ?? null,
        loanProductId: body.loanProductId,
        coApplicantIds: body.coApplicantIds
          ? JSON.stringify(body.coApplicantIds)
          : null,
        loanAmount: body.loanAmount as any,
        loanTerm: body.loanTerm,
        currency: body.currency,
        purpose: body.purpose as any,
        purposeDescription: body.purposeDescription ?? null,
        status: "draft" as any,
        submittedAt: null,
        isBusinessLoan: body.isBusinessLoan,
      };

      const [row] = await db
        .insert(loanApplications)
        .values(values)
        .returning();

      // Log application creation to audit trail
      await AuditTrailService.logAction({
        loanApplicationId: row.id,
        userId: user.id,
        action: "application_created",
        reason: "User created loan application",
        details: `Application ${applicationNumber} created for ${body.isBusinessLoan ? 'business' : 'personal'} loan`,
        metadata: {
          applicationNumber,
          loanAmount: body.loanAmount,
          loanTerm: body.loanTerm,
          purpose: body.purpose,
          isBusinessLoan: body.isBusinessLoan,
        },
      });

      // Create product snapshot for immutability
      await db.insert(loanProductSnapshots).values({
        loanApplicationId: row.id,
        loanProductId: loanProduct.id,
        productSnapshot: {
          id: loanProduct.id,
          name: loanProduct.name,
          slug: loanProduct.slug,
          imageUrl: loanProduct.imageUrl,
          summary: loanProduct.summary,
          description: loanProduct.description,
          currency: loanProduct.currency,
          minAmount: toNumber(loanProduct.minAmount),
          maxAmount: toNumber(loanProduct.maxAmount),
          minTerm: loanProduct.minTerm,
          maxTerm: loanProduct.maxTerm,
          termUnit: loanProduct.termUnit,
          interestRate: toNumber(loanProduct.interestRate),
          interestType: loanProduct.interestType,
          ratePeriod: loanProduct.ratePeriod,
          amortizationMethod: loanProduct.amortizationMethod,
          repaymentFrequency: loanProduct.repaymentFrequency,
          processingFeeFlat: toNumber(loanProduct.processingFeeFlat) ?? 0,
          lateFeeRate: toNumber(loanProduct.lateFeeRate) ?? 0,
          lateFeeFlat: toNumber(loanProduct.lateFeeFlat) ?? 0,
          prepaymentPenaltyRate: toNumber(loanProduct.prepaymentPenaltyRate) ?? 0,
          gracePeriodDays: loanProduct.gracePeriodDays ?? 0,
          version: loanProduct.version ?? 1,
          status: loanProduct.status ?? "active",
          createdAt: loanProduct.createdAt?.toISOString() ?? new Date().toISOString(),
          updatedAt: loanProduct.updatedAt?.toISOString() ?? new Date().toISOString(),
        },
        productVersion: String(loanProduct.version ?? 1),
        snapshotReason: "application_creation",
      });

      const application = mapLoanApplicationRow(row);

      return {
        success: true,
        message: "Loan application submitted successfully",
        data: application,
      };
    } catch (error: any) {
      logger.error("Error creating loan application:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[CREATE_LOAN_APPLICATION_ERROR] Failed to create loan application",
      );
    }
  }


  /**
   * List loan applications with optional filtering and pagination
   */
  static async list(
    clerkId: string,
    query: LoanApplicationsModel.ListLoanApplicationsQuery = {},
  ): Promise<LoanApplicationsModel.ListLoanApplicationsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const page = query.page ? parseInt(query.page as string) : 1;
      const limit = query.limit ? parseInt(query.limit as string) : 20;
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [isNull(loanApplications.deletedAt)];

      // Filter by user (users can only see their own applications)
      whereConditions.push(eq(loanApplications.userId, user.id));

      if (query.status) {
        whereConditions.push(eq(loanApplications.status, query.status));
      }
      if (query.isBusinessLoan !== undefined) {
        const isBusinessLoan = query.isBusinessLoan === "true";
        whereConditions.push(
          eq(loanApplications.isBusinessLoan, isBusinessLoan),
        );
      }
      if (query.businessId) {
        whereConditions.push(eq(loanApplications.businessId, query.businessId));
      }
      if (query.loanProductId) {
        whereConditions.push(
          eq(loanApplications.loanProductId, query.loanProductId),
        );
      }

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(loanApplications)
        .where(and(...whereConditions));

      // Get applications with related data
      const rows = await db
        .select({
          application: loanApplications,
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          business: {
            id: businessProfiles.id,
            name: businessProfiles.name,
          },
          loanProduct: {
            id: loanProducts.id,
            name: loanProducts.name,
            currency: loanProducts.currency,
            minAmount: loanProducts.minAmount,
            maxAmount: loanProducts.maxAmount,
            minTerm: loanProducts.minTerm,
            maxTerm: loanProducts.maxTerm,
            termUnit: loanProducts.termUnit,
            interestRate: loanProducts.interestRate,
          },
        })
        .from(loanApplications)
        .leftJoin(users, eq(loanApplications.userId, users.id))
        .leftJoin(
          businessProfiles,
          eq(loanApplications.businessId, businessProfiles.id),
        )
        .leftJoin(
          loanProducts,
          eq(loanApplications.loanProductId, loanProducts.id),
        )
        .where(and(...whereConditions))
        .orderBy(desc(loanApplications.createdAt))
        .limit(limit)
        .offset(offset);

      const applications = rows.map((row) =>
        mapLoanApplicationRow(row.application, {
          user: row.user,
          business: row.business,
          loanProduct: row.loanProduct,
        }),
      );

      return {
        success: true,
        message: "Loan applications retrieved successfully",
        data: applications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing loan applications:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[LIST_LOAN_APPLICATIONS_ERROR] Failed to list loan applications",
      );
    }
  }

  /**
   * Get a single loan application by ID
   */
  static async getById(
    clerkId: string,
    id: string,
  ): Promise<LoanApplicationsModel.GetLoanApplicationResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [row] = await db
        .select({
          application: loanApplications,
          user: {
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
          },
          business: {
            id: businessProfiles.id,
            name: businessProfiles.name,
          },
          loanProduct: {
            id: loanProducts.id,
            name: loanProducts.name,
            currency: loanProducts.currency,
            minAmount: loanProducts.minAmount,
            maxAmount: loanProducts.maxAmount,
            minTerm: loanProducts.minTerm,
            maxTerm: loanProducts.maxTerm,
            termUnit: loanProducts.termUnit,
            interestRate: loanProducts.interestRate,
          },
        })
        .from(loanApplications)
        .leftJoin(users, eq(loanApplications.userId, users.id))
        .leftJoin(
          businessProfiles,
          eq(loanApplications.businessId, businessProfiles.id),
        )
        .leftJoin(
          loanProducts,
          eq(loanApplications.loanProductId, loanProducts.id),
        )
        .where(
          and(
            eq(loanApplications.id, id),
            eq(loanApplications.userId, user.id),
            isNull(loanApplications.deletedAt),
          ),
        )
        .limit(1);

      if (!row)
        throw httpError(
          404,
          "[LOAN_APPLICATION_NOT_FOUND] Loan application not found",
        );

      // Get offer letters for this application
      const offerLetterRows = await db
        .select()
        .from(offerLetters)
        .where(
          and(
            eq(offerLetters.loanApplicationId, id),
            isNull(offerLetters.deletedAt),
          ),
        )
        .orderBy(desc(offerLetters.createdAt));

      const application = mapLoanApplicationRow(row.application, {
        user: row.user,
        business: row.business,
        loanProduct: row.loanProduct,
        offerLetters: offerLetterRows,
      });

      return {
        success: true,
        message: "Loan application retrieved successfully",
        data: application,
      };
    } catch (error: any) {
      logger.error("Error getting loan application:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[GET_LOAN_APPLICATION_ERROR] Failed to get loan application",
      );
    }
  }

  /**
   * Update a loan application (only submitted applications can be updated)
   */
  static async update(
    clerkId: string,
    id: string,
    body: LoanApplicationsModel.UpdateLoanApplicationBody,
  ): Promise<LoanApplicationsModel.UpdateLoanApplicationResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(loanApplications)
        .where(
          and(
            eq(loanApplications.id, id),
            eq(loanApplications.userId, user.id),
            isNull(loanApplications.deletedAt),
          ),
        )
        .limit(1);

      if (!existing)
        throw httpError(
          404,
          "[LOAN_APPLICATION_NOT_FOUND] Loan application not found",
        );

      if (existing.status !== "draft" && existing.status !== "submitted") {
        throw httpError(
          400,
          "[INVALID_STATUS] Only draft and submitted applications can be updated",
        );
      }

      // If loan amount or term is being updated, validate against product constraints
      if (body.loanAmount !== undefined || body.loanTerm !== undefined) {
        const [loanProduct] = await db
          .select()
          .from(loanProducts)
          .where(
            and(
              eq(loanProducts.id, existing.loanProductId),
              isNull(loanProducts.deletedAt),
            ),
          )
          .limit(1);

        if (loanProduct) {
          const minAmount = toNumber(loanProduct.minAmount) ?? 0;
          const maxAmount = toNumber(loanProduct.maxAmount) ?? 0;
          const loanAmount =
            body.loanAmount ?? toNumber(existing.loanAmount) ?? 0;
          const loanTerm = body.loanTerm ?? existing.loanTerm;

          if (loanAmount < minAmount || loanAmount > maxAmount) {
            throw httpError(
              400,
              `[INVALID_AMOUNT] Loan amount must be between ${minAmount} and ${maxAmount}`,
            );
          }

          if (
            loanTerm < loanProduct.minTerm ||
            loanTerm > loanProduct.maxTerm
          ) {
            throw httpError(
              400,
              `[INVALID_TERM] Loan term must be between ${loanProduct.minTerm} and ${loanProduct.maxTerm} ${loanProduct.termUnit}`,
            );
          }
        }
      }

      const updateSet: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (body.loanAmount !== undefined) updateSet.loanAmount = body.loanAmount;
      if (body.loanTerm !== undefined) updateSet.loanTerm = body.loanTerm;
      if (body.purpose !== undefined) updateSet.purpose = body.purpose;
      if (body.purposeDescription !== undefined)
        updateSet.purposeDescription = body.purposeDescription;
      if (body.coApplicantIds !== undefined)
        updateSet.coApplicantIds = JSON.stringify(body.coApplicantIds);

      const [row] = await db
        .update(loanApplications)
        .set(updateSet)
        .where(eq(loanApplications.id, id))
        .returning();

      // Log application update to audit trail
      await AuditTrailService.logAction({
        loanApplicationId: id,
        userId: user.id,
        action: "status_updated",
        reason: "User updated loan application details",
        details: `Application ${existing.applicationNumber} updated`,
        beforeData: {
          loanAmount: existing.loanAmount,
          loanTerm: existing.loanTerm,
          purpose: existing.purpose,
          purposeDescription: existing.purposeDescription,
          coApplicantIds: existing.coApplicantIds,
        },
        afterData: {
          loanAmount: body.loanAmount !== undefined ? body.loanAmount : existing.loanAmount,
          loanTerm: body.loanTerm !== undefined ? body.loanTerm : existing.loanTerm,
          purpose: body.purpose !== undefined ? body.purpose : existing.purpose,
          purposeDescription: body.purposeDescription !== undefined ? body.purposeDescription : existing.purposeDescription,
          coApplicantIds: body.coApplicantIds !== undefined ? JSON.stringify(body.coApplicantIds) : existing.coApplicantIds,
        },
        metadata: {
          applicationNumber: existing.applicationNumber,
          updatedFields: Object.keys(body).filter(key => body[key as keyof typeof body] !== undefined),
        },
      });

      const application = mapLoanApplicationRow(row);

      return {
        success: true,
        message: "Loan application updated successfully",
        data: application,
      };
    } catch (error: any) {
      logger.error("Error updating loan application:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[UPDATE_LOAN_APPLICATION_ERROR] Failed to update loan application",
      );
    }
  }

  /**
   * Update application status (admin/loan officer function)
   */
  static async updateStatus(
    clerkId: string,
    id: string,
    body: LoanApplicationsModel.UpdateApplicationStatusBody,
  ): Promise<LoanApplicationsModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select()
        .from(loanApplications)
        .where(
          and(eq(loanApplications.id, id), isNull(loanApplications.deletedAt)),
        )
        .limit(1);

      if (!existing)
        throw httpError(
          404,
          "[LOAN_APPLICATION_NOT_FOUND] Loan application not found",
        );

      const updateSet: Record<string, any> = {
        status: body.status,
        updatedAt: new Date(),
      };

      // Set appropriate timestamp based on status
      switch (body.status) {
        case "under_review":
          updateSet.reviewedAt = new Date();
          break;
        case "approved":
          updateSet.approvedAt = new Date();
          break;
        case "offer_letter_sent":
          // Offer letter sent timestamp will be set by offer letter service
          break;
        case "offer_letter_signed":
          // Offer letter signed timestamp will be set by offer letter service
          break;
        case "offer_letter_declined":
          // Offer letter declined timestamp will be set by offer letter service
          break;
        case "disbursed":
          updateSet.disbursedAt = new Date();
          break;
        case "rejected":
          updateSet.rejectedAt = new Date();
          updateSet.rejectionReason = body.rejectionReason;
          break;
      }

      // Get user for audit trail
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      await db
        .update(loanApplications)
        .set({
          ...updateSet,
          statusReason: `Status updated to ${body.status}`,
          lastUpdatedBy: user.id,
          lastUpdatedAt: new Date(),
        })
        .where(eq(loanApplications.id, id));

      // Log status update to audit trail
      await AuditTrailService.logAction({
        loanApplicationId: id,
        userId: user.id,
        action: `application_${body.status}` as any,
        reason: `Application status updated to ${body.status}`,
        details: body.rejectionReason || `Status changed from ${existing.status} to ${body.status}`,
        beforeData: { status: existing.status },
        afterData: { status: body.status, ...updateSet },
        metadata: {
          previousStatus: existing.status,
          newStatus: body.status,
          rejectionReason: body.rejectionReason,
        },
      });

      // Create snapshot when application is approved
      if (body.status === "approved") {
        await SnapshotService.createSnapshot({
          loanApplicationId: id,
          createdBy: user.id,
          approvalStage: "loan_approval",
        });

        // Log snapshot creation
        await AuditTrailService.logAction({
          loanApplicationId: id,
          userId: user.id,
          action: "snapshot_created",
          reason: "Immutable snapshot created at loan approval",
          details: "Complete application state captured for audit trail",
          metadata: {
            approvalStage: "loan_approval",
          },
        });
      }

      // Create offer letter when status changes to offer_letter_sent
      if (body.status === "offer_letter_sent") {
        try {
          // Get loan application details for offer letter creation
          const loanApp = await db.query.loanApplications.findFirst({
            where: eq(loanApplications.id, id),
            with: {
              business: true,
              user: true,
              loanProduct: true,
            },
          });

          if (loanApp) {
            // Create offer letter with basic details
            await OfferLettersService.create(clerkId, {
              loanApplicationId: id,
              recipientEmail: loanApp.user.email,
              recipientName: `${loanApp.user.firstName} ${loanApp.user.lastName}`,
              offerAmount: Number(loanApp.loanAmount),
              offerTerm: loanApp.loanTerm,
              interestRate: Number(loanApp.loanProduct.interestRate),
              currency: loanApp.currency,
              specialConditions: undefined,
              requiresGuarantor: false,
              requiresCollateral: false,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            });

            // Log offer letter creation
            await AuditTrailService.logAction({
              loanApplicationId: id,
              userId: user.id,
              action: "offer_letter_created",
              reason: "Offer letter created for approved loan application",
              details: `Offer letter created for loan amount ${loanApp.currency} ${loanApp.loanAmount}`,
              metadata: {
                loanAmount: loanApp.loanAmount,
                loanTerm: loanApp.loanTerm,
                interestRate: loanApp.loanProduct.interestRate,
                currency: loanApp.currency,
              },
            });
          }
        } catch (error) {
          logger.error("Failed to create offer letter:", error);
          // Don't fail the status update if offer letter creation fails
        }
      }

      // Send status update notification
      try {
        await NotificationService.sendStatusUpdateNotification(
          id,
          existing.userId,
          {
            previousStatus: existing.status as any,
            newStatus: body.status,
            reason: body.rejectionReason || `Status updated to ${body.status}`,
            rejectionReason: body.rejectionReason,
          },
          ['email']
        );
      } catch (error) {
        logger.error("Failed to send status update notification:", error);
        // Don't fail the status update if notification fails
      }

      return {
        success: true,
        message: `Loan application status updated to ${body.status}`,
      };
    } catch (error: any) {
      logger.error("Error updating loan application status:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[UPDATE_LOAN_APPLICATION_STATUS_ERROR] Failed to update loan application status",
      );
    }
  }

  /**
   * Withdraw a loan application
   */
  static async withdraw(
    clerkId: string,
    id: string,
  ): Promise<LoanApplicationsModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(loanApplications)
        .where(
          and(
            eq(loanApplications.id, id),
            eq(loanApplications.userId, user.id),
            isNull(loanApplications.deletedAt),
          ),
        )
        .limit(1);

      if (!existing)
        throw httpError(
          404,
          "[LOAN_APPLICATION_NOT_FOUND] Loan application not found",
        );

      if (["disbursed", "rejected", "withdrawn"].includes(existing.status)) {
        throw httpError(
          400,
          "[INVALID_STATUS] Application cannot be withdrawn in current status",
        );
      }

      await db
        .update(loanApplications)
        .set({
          status: "withdrawn",
          updatedAt: new Date(),
          statusReason: "Application withdrawn by user",
          lastUpdatedBy: user.id,
          lastUpdatedAt: new Date(),
        })
        .where(eq(loanApplications.id, id));

      // Log application withdrawal to audit trail
      await AuditTrailService.logAction({
        loanApplicationId: id,
        userId: user.id,
        action: "application_withdrawn",
        reason: "User withdrew loan application",
        details: `Application ${existing.applicationNumber} withdrawn by user`,
        beforeData: { status: existing.status },
        afterData: { status: "withdrawn" },
        metadata: {
          applicationNumber: existing.applicationNumber,
          previousStatus: existing.status,
        },
      });

      // Send withdrawal notification
      try {
        await NotificationService.sendStatusUpdateNotification(
          id,
          user.id,
          {
            previousStatus: existing.status as any,
            newStatus: "withdrawn",
            reason: "Application withdrawn by user",
          },
          ['email']
        );
      } catch (error) {
        logger.error("Failed to send withdrawal notification:", error);
        // Don't fail the withdrawal if notification fails
      }

      return {
        success: true,
        message: "Loan application withdrawn successfully",
      };
    } catch (error: any) {
      logger.error("Error withdrawing loan application:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[WITHDRAW_LOAN_APPLICATION_ERROR] Failed to withdraw loan application",
      );
    }
  }

  /**
   * Soft delete a loan application
   */
  static async remove(
    clerkId: string,
    id: string,
  ): Promise<LoanApplicationsModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(loanApplications)
        .where(
          and(
            eq(loanApplications.id, id),
            eq(loanApplications.userId, user.id),
            isNull(loanApplications.deletedAt),
          ),
        )
        .limit(1);

      if (!existing)
        throw httpError(
          404,
          "[LOAN_APPLICATION_NOT_FOUND] Loan application not found",
        );

      // Only allow deletion of submitted applications (not yet under review)
      if (existing.status !== "submitted") {
        throw httpError(
          400,
          "[INVALID_STATUS] Only submitted applications can be deleted",
        );
      }

      await db
        .update(loanApplications)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          statusReason: "Application deleted by user",
          lastUpdatedBy: user.id,
          lastUpdatedAt: new Date(),
        })
        .where(eq(loanApplications.id, id));

      // Log application deletion to audit trail
      await AuditTrailService.logAction({
        loanApplicationId: id,
        userId: user.id,
        action: "application_deleted",
        reason: "User deleted loan application",
        details: `Application ${existing.applicationNumber} deleted by user`,
        beforeData: { 
          status: existing.status,
          deletedAt: null,
        },
        afterData: { 
          status: existing.status,
          deletedAt: new Date(),
        },
        metadata: {
          applicationNumber: existing.applicationNumber,
          previousStatus: existing.status,
        },
      });

      return {
        success: true,
        message: "Loan application deleted successfully",
      };
    } catch (error: any) {
      logger.error("Error deleting loan application:", error);
      if (error?.status) throw error;
      throw httpError(
        500,
        "[DELETE_LOAN_APPLICATION_ERROR] Failed to delete loan application",
      );
    }
  }
}
