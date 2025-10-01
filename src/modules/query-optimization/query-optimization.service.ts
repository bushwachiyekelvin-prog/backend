import { db } from "../../db";
import { applicationAuditTrail } from "../../db/schema/applicationAuditTrail";
import { loanApplicationSnapshots } from "../../db/schema/loanApplicationSnapshots";
import { documentRequests } from "../../db/schema/documentRequests";
import { personalDocuments } from "../../db/schema/personalDocuments";
import { businessDocuments } from "../../db/schema/businessDocuments";
import { loanApplications } from "../../db/schema/loanApplications";
import { users } from "../../db/schema/users";
import { eq, and, desc, isNull, inArray, sql } from "drizzle-orm";
import { logger } from "../../utils/logger";
import { CachingService } from "../caching/caching.service";

// Lightweight HTTP error helper
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export interface QueryOptimizationParams {
  loanApplicationId?: string;
  userId?: string;
  action?: string;
  status?: string;
  documentType?: string;
  limit?: number;
  offset?: number;
}

export interface OptimizedAuditTrailEntry {
  id: string;
  loanApplicationId: string;
  userId: string;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  action: string;
  reason: string | null;
  details: string | null;
  metadata: any;
  beforeData: any;
  afterData: any;
  createdAt: string;
}

export interface OptimizedDocumentRequest {
  id: string;
  loanApplicationId: string;
  requestedBy: string;
  requestedFrom: string;
  requestedByEmail?: string | null;
  requestedFromEmail?: string | null;
  documentType: string;
  description: string;
  isRequired: string;
  status: string;
  fulfilledAt?: string;
  fulfilledWith?: string | null;
  createdAt: string;
}

export interface OptimizedSnapshot {
  id: string;
  loanApplicationId: string;
  createdBy: string;
  createdByEmail?: string | null;
  snapshotData: any;
  approvalStage: string;
  createdAt: string;
}

export abstract class QueryOptimizationService {
  /**
   * Get optimized audit trail with user information in a single query
   */
  static async getOptimizedAuditTrail(params: QueryOptimizationParams): Promise<OptimizedAuditTrailEntry[]> {
    const cacheKey = CachingService.keys.auditTrail(
      params.loanApplicationId || 'all',
      params
    );

    return CachingService.withCache(
      cacheKey,
      async () => {
        try {
          const limit = params.limit || 100;
          const offset = params.offset || 0;

          // Build conditions
          const conditions = [];
          if (params.loanApplicationId) {
            conditions.push(eq(applicationAuditTrail.loanApplicationId, params.loanApplicationId));
          }
          if (params.userId) {
            conditions.push(eq(applicationAuditTrail.userId, params.userId));
          }
      if (params.action) {
        conditions.push(eq(applicationAuditTrail.action, params.action as any));
      }

          // Optimized query with JOIN to get user information
          const results = await db
            .select({
              id: applicationAuditTrail.id,
              loanApplicationId: applicationAuditTrail.loanApplicationId,
              userId: applicationAuditTrail.userId,
              userEmail: users.email,
              userFirstName: users.firstName,
              userLastName: users.lastName,
              action: applicationAuditTrail.action,
              reason: applicationAuditTrail.reason,
              details: applicationAuditTrail.details,
              metadata: applicationAuditTrail.metadata,
              beforeData: applicationAuditTrail.beforeData,
              afterData: applicationAuditTrail.afterData,
              createdAt: applicationAuditTrail.createdAt,
            })
            .from(applicationAuditTrail)
            .leftJoin(users, eq(applicationAuditTrail.userId, users.id))
            .where(and(...conditions))
            .orderBy(desc(applicationAuditTrail.createdAt))
            .limit(limit)
            .offset(offset);

          return results.map(result => ({
            ...result,
            createdAt: result.createdAt.toISOString(),
          })) as OptimizedAuditTrailEntry[];
        } catch (error: any) {
          logger.error("Error getting optimized audit trail:", error);
          throw httpError(500, "[QUERY_OPTIMIZATION_ERROR] Failed to get optimized audit trail");
        }
      },
      2 * 60 // 2 minutes cache TTL in seconds
    );
  }

  /**
   * Get optimized document requests with user information in a single query
   */
  static async getOptimizedDocumentRequests(params: QueryOptimizationParams): Promise<OptimizedDocumentRequest[]> {
    try {
      const limit = params.limit || 100;
      const offset = params.offset || 0;

      // Build conditions
      const conditions = [];
      if (params.loanApplicationId) {
        conditions.push(eq(documentRequests.loanApplicationId, params.loanApplicationId));
      }
      if (params.status) {
        conditions.push(eq(documentRequests.status, params.status as any));
      }
      if (params.documentType) {
        conditions.push(eq(documentRequests.documentType, params.documentType as any));
      }

      // Optimized query with JOINs to get user information
      const results = await db
        .select({
          id: documentRequests.id,
          loanApplicationId: documentRequests.loanApplicationId,
          requestedBy: documentRequests.requestedBy,
          requestedFrom: documentRequests.requestedFrom,
          requestedByEmail: sql`requested_by_user.email`.as('requestedByEmail') as any,
          requestedFromEmail: sql`requested_from_user.email`.as('requestedFromEmail') as any,
          documentType: documentRequests.documentType,
          description: documentRequests.description,
          isRequired: documentRequests.isRequired,
          status: documentRequests.status,
          fulfilledAt: documentRequests.fulfilledAt,
          fulfilledWith: documentRequests.fulfilledWith,
          createdAt: documentRequests.createdAt,
        })
        .from(documentRequests)
        .leftJoin(sql`users as requested_by_user`, eq(documentRequests.requestedBy, sql`requested_by_user.id`))
        .leftJoin(sql`users as requested_from_user`, eq(documentRequests.requestedFrom, sql`requested_from_user.id`))
        .where(and(...conditions))
        .orderBy(desc(documentRequests.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => ({
        ...result,
        fulfilledAt: result.fulfilledAt?.toISOString() || undefined,
        createdAt: result.createdAt.toISOString(),
      })) as OptimizedDocumentRequest[];
    } catch (error: any) {
      logger.error("Error getting optimized document requests:", error);
      throw httpError(500, "[QUERY_OPTIMIZATION_ERROR] Failed to get optimized document requests");
    }
  }

  /**
   * Get optimized snapshots with user information in a single query
   */
  static async getOptimizedSnapshots(params: QueryOptimizationParams): Promise<OptimizedSnapshot[]> {
    try {
      const limit = params.limit || 100;
      const offset = params.offset || 0;

      // Build conditions
      const conditions = [];
      if (params.loanApplicationId) {
        conditions.push(eq(loanApplicationSnapshots.loanApplicationId, params.loanApplicationId));
      }

      // Optimized query with JOIN to get user information
      const results = await db
        .select({
          id: loanApplicationSnapshots.id,
          loanApplicationId: loanApplicationSnapshots.loanApplicationId,
          createdBy: loanApplicationSnapshots.createdBy,
          createdByEmail: users.email,
          snapshotData: loanApplicationSnapshots.snapshotData,
          approvalStage: loanApplicationSnapshots.approvalStage,
          createdAt: loanApplicationSnapshots.createdAt,
        })
        .from(loanApplicationSnapshots)
        .leftJoin(users, eq(loanApplicationSnapshots.createdBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(loanApplicationSnapshots.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map(result => ({
        ...result,
        snapshotData: JSON.parse(result.snapshotData),
        createdAt: result.createdAt.toISOString(),
      }));
    } catch (error: any) {
      logger.error("Error getting optimized snapshots:", error);
      throw httpError(500, "[QUERY_OPTIMIZATION_ERROR] Failed to get optimized snapshots");
    }
  }

  /**
   * Get document statistics for a loan application in a single query
   */
  static async getDocumentStatistics(loanApplicationId: string): Promise<{
    personalDocuments: number;
    businessDocuments: number;
    documentRequests: number;
    pendingRequests: number;
    fulfilledRequests: number;
  }> {
    const cacheKey = CachingService.keys.documentStatistics(loanApplicationId);

    return CachingService.withCache(
      cacheKey,
      async () => {
        try {
          // Get loan application to determine if it's business or personal
          const application = await db
            .select({
              userId: loanApplications.userId,
              businessId: loanApplications.businessId,
            })
            .from(loanApplications)
            .where(eq(loanApplications.id, loanApplicationId))
            .limit(1);

          if (!application.length) {
            throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
          }

          const app = application[0];

          // Get personal documents count
          const personalDocsResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(personalDocuments)
            .where(
              and(
                eq(personalDocuments.userId, app.userId),
                isNull(personalDocuments.deletedAt)
              )
            );

          // Get business documents count (if business loan)
          let businessDocsCount = 0;
          if (app.businessId) {
            const businessDocsResult = await db
              .select({ count: sql<number>`count(*)` })
              .from(businessDocuments)
              .where(
                and(
                  eq(businessDocuments.businessId, app.businessId),
                  isNull(businessDocuments.deletedAt)
                )
              );
            businessDocsCount = businessDocsResult[0]?.count || 0;
          }

          // Get document requests statistics
          const documentRequestsResult = await db
            .select({
              total: sql<number>`count(*)`,
              pending: sql<number>`count(*) filter (where status = 'pending')`,
              fulfilled: sql<number>`count(*) filter (where status = 'fulfilled')`,
            })
            .from(documentRequests)
            .where(eq(documentRequests.loanApplicationId, loanApplicationId));

          const docRequests = documentRequestsResult[0];

          return {
            personalDocuments: personalDocsResult[0]?.count || 0,
            businessDocuments: businessDocsCount,
            documentRequests: docRequests?.total || 0,
            pendingRequests: docRequests?.pending || 0,
            fulfilledRequests: docRequests?.fulfilled || 0,
          };
        } catch (error: any) {
          logger.error("Error getting document statistics:", error);
          if (error?.status) throw error;
          throw httpError(500, "[QUERY_OPTIMIZATION_ERROR] Failed to get document statistics");
        }
      },
      5 * 60 // 5 minutes cache TTL in seconds
    );
  }

  /**
   * Get loan application summary with all related data in optimized queries
   */
  static async getLoanApplicationSummary(loanApplicationId: string): Promise<{
    application: any;
    documents: {
      personal: any[];
      business: any[];
    };
    auditTrail: OptimizedAuditTrailEntry[];
    snapshots: OptimizedSnapshot[];
    documentRequests: OptimizedDocumentRequest[];
    statistics: any;
  }> {
    try {
      // Get application with user and business information
      const applicationResult = await db
        .select({
          id: loanApplications.id,
          applicationNumber: loanApplications.applicationNumber,
          userId: loanApplications.userId,
          businessId: loanApplications.businessId,
          loanProductId: loanApplications.loanProductId,
          status: loanApplications.status,
          loanAmount: loanApplications.loanAmount,
          loanTerm: loanApplications.loanTerm,
          purpose: loanApplications.purpose,
          purposeDescription: loanApplications.purposeDescription,
          coApplicantIds: loanApplications.coApplicantIds,
          submittedAt: loanApplications.submittedAt,
          createdAt: loanApplications.createdAt,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
        })
        .from(loanApplications)
        .leftJoin(users, eq(loanApplications.userId, users.id))
        .where(eq(loanApplications.id, loanApplicationId))
        .limit(1);

      if (!applicationResult.length) {
        throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
      }

      const application = applicationResult[0];

      // Get documents in parallel
      const [personalDocs, businessDocs, auditTrail, snapshots, documentRequests, statistics] = await Promise.all([
        // Personal documents
        db
          .select()
          .from(personalDocuments)
          .where(
            and(
              eq(personalDocuments.userId, application.userId),
              isNull(personalDocuments.deletedAt)
            )
          ),

        // Business documents (if business loan)
        application.businessId
          ? db
              .select()
              .from(businessDocuments)
              .where(
                and(
                  eq(businessDocuments.businessId, application.businessId),
                  isNull(businessDocuments.deletedAt)
                )
              )
          : Promise.resolve([]),

        // Audit trail (last 10 entries)
        this.getOptimizedAuditTrail({
          loanApplicationId,
          limit: 10,
        }),

        // Snapshots (last 5)
        this.getOptimizedSnapshots({
          loanApplicationId,
          limit: 5,
        }),

        // Document requests (last 10)
        this.getOptimizedDocumentRequests({
          loanApplicationId,
          limit: 10,
        }),

        // Statistics
        this.getDocumentStatistics(loanApplicationId),
      ]);

      return {
        application: {
          ...application,
          createdAt: application.createdAt.toISOString(),
          submittedAt: application.submittedAt?.toISOString(),
        },
        documents: {
          personal: personalDocs,
          business: businessDocs,
        },
        auditTrail,
        snapshots,
        documentRequests,
        statistics,
      };
    } catch (error: any) {
      logger.error("Error getting loan application summary:", error);
      if (error?.status) throw error;
      throw httpError(500, "[QUERY_OPTIMIZATION_ERROR] Failed to get loan application summary");
    }
  }
}
