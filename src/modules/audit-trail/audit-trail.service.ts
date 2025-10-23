import { db } from "../../db";
import { applicationAuditTrail, type AuditAction } from "../../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { CachingService } from "../caching/caching.service";
import { logger } from "../../utils/logger";

function httpError(status: number, message: string) {
  const error = new Error(message) as any;
  error.statusCode = status;
  return error;
}

export interface LogActionParams {
  loanApplicationId: string;
  userId: string;
  action: AuditAction;
  reason?: string;
  details?: string;
  metadata?: Record<string, any>;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
}

export interface GetAuditTrailParams {
  loanApplicationId: string;
  limit?: number;
  offset?: number;
  action?: AuditAction;
}

export interface AuditTrailEntry {
  id: string;
  loanApplicationId: string;
  userId: string;
  action: AuditAction;
  reason?: string | null;
  details?: string | null;
  metadata?: string | null;
  beforeData?: string | null;
  afterData?: string | null;
  createdAt: string;
}

export abstract class AuditTrailService {
  /**
   * Log an action to the audit trail
   * 
   * @param params - Action details to log
   * @returns Created audit trail entry
   * 
   * @throws {400} If required parameters are missing
   * @throws {500} If logging fails
   */
  static async logAction(params: LogActionParams): Promise<AuditTrailEntry> {
    try {
      // Validate required parameters
      if (!params.loanApplicationId || !params.userId || !params.action) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId, userId, and action are required");
      }

      // Prepare data for insertion
      const insertData = {
        loanApplicationId: params.loanApplicationId,
        userId: params.userId,
        action: params.action,
        reason: params.reason || null,
        details: params.details || null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
        afterData: params.afterData ? JSON.stringify(params.afterData) : null,
      };

      // Insert audit trail entry
      const [result] = await db
        .insert(applicationAuditTrail)
        .values(insertData)
        .returning();

      if (!result) {
        throw httpError(500, "[AUDIT_LOG_FAILED] Failed to create audit trail entry");
      }

      // Invalidate audit trail cache for this loan application
      try {
        await CachingService.invalidatePattern(`audit_trail:${params.loanApplicationId}:*`);
        logger.debug(`Cache invalidated for audit trail of loan application ${params.loanApplicationId}`);
      } catch (cacheError) {
        logger.error(`Error invalidating cache for audit trail of loan application ${params.loanApplicationId}:`, cacheError);
        // Don't throw - cache invalidation failure shouldn't prevent audit logging
      }

      // Return formatted result
      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        userId: result.userId,
        action: result.action,
        reason: result.reason,
        details: result.details,
        metadata: result.metadata,
        beforeData: result.beforeData,
        afterData: result.afterData,
        createdAt: result.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[AUDIT_LOG_ERROR] ${error.message}`);
    }
  }

  /**
   * Get audit trail for a loan application
   * 
   * @param params - Query parameters
   * @returns Array of audit trail entries
   * 
   * @throws {400} If loanApplicationId is missing
   * @throws {500} If query fails
   */
  static async getAuditTrail(params: GetAuditTrailParams): Promise<AuditTrailEntry[]> {
    try {
      // Validate required parameters
      if (!params.loanApplicationId) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId is required");
      }

      // Build query conditions
      const conditions = [eq(applicationAuditTrail.loanApplicationId, params.loanApplicationId)];
      
      if (params.action) {
        conditions.push(eq(applicationAuditTrail.action, params.action));
      }

      // Execute query
      const results = await db
        .select()
        .from(applicationAuditTrail)
        .where(and(...conditions))
        .orderBy(desc(applicationAuditTrail.createdAt))
        .limit(params.limit || 100)
        .offset(params.offset || 0);

      // Format results
      return results.map(result => ({
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        userId: result.userId,
        action: result.action,
        reason: result.reason,
        details: result.details,
        metadata: result.metadata,
        beforeData: result.beforeData,
        afterData: result.afterData,
        createdAt: result.createdAt.toISOString(),
      }));
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[AUDIT_TRAIL_ERROR] ${error.message}`);
    }
  }

  /**
   * Get audit trail summary for a loan application
   * 
   * @param loanApplicationId - Loan application ID
   * @returns Summary of audit trail entries
   * 
   * @throws {400} If loanApplicationId is missing
   * @throws {500} If query fails
   */
  static async getAuditTrailSummary(loanApplicationId: string): Promise<{
    totalEntries: number;
    lastAction?: AuditAction;
    lastActionAt?: string;
    actions: Record<AuditAction, number>;
  }> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId is required");
      }

      // Get all entries for the application
      const entries = await db
        .select()
        .from(applicationAuditTrail)
        .where(eq(applicationAuditTrail.loanApplicationId, loanApplicationId))
        .orderBy(desc(applicationAuditTrail.createdAt));

      // Calculate summary
      const totalEntries = entries.length;
      const lastAction = entries[0]?.action;
      const lastActionAt = entries[0]?.createdAt.toISOString();
      
      // Count actions
      const actions: Record<AuditAction, number> = {} as Record<AuditAction, number>;
      entries.forEach(entry => {
        actions[entry.action] = (actions[entry.action] || 0) + 1;
      });

      return {
        totalEntries,
        lastAction,
        lastActionAt,
        actions,
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[AUDIT_SUMMARY_ERROR] ${error.message}`);
    }
  }

  /**
   * Log multiple actions in a single transaction
   * 
   * @param actions - Array of actions to log
   * @returns Array of created audit trail entries
   * 
   * @throws {400} If actions array is empty
   * @throws {500} If transaction fails
   */
  static async logMultipleActions(actions: LogActionParams[]): Promise<AuditTrailEntry[]> {
    try {
      if (!actions || actions.length === 0) {
        throw httpError(400, "[INVALID_PARAMETERS] actions array cannot be empty");
      }

      // Validate all actions
      for (const action of actions) {
        if (!action.loanApplicationId || !action.userId || !action.action) {
          throw httpError(400, "[INVALID_PARAMETERS] All actions must have loanApplicationId, userId, and action");
        }
      }

      // Prepare data for insertion
      const insertData = actions.map(action => ({
        loanApplicationId: action.loanApplicationId,
        userId: action.userId,
        action: action.action,
        reason: action.reason || null,
        details: action.details || null,
        metadata: action.metadata ? JSON.stringify(action.metadata) : null,
        beforeData: action.beforeData ? JSON.stringify(action.beforeData) : null,
        afterData: action.afterData ? JSON.stringify(action.afterData) : null,
      }));

      // Insert all entries in a transaction
      const results = await db
        .insert(applicationAuditTrail)
        .values(insertData)
        .returning();

      // Format results
      return results.map(result => ({
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        userId: result.userId,
        action: result.action,
        reason: result.reason,
        details: result.details,
        metadata: result.metadata,
        beforeData: result.beforeData,
        afterData: result.afterData,
        createdAt: result.createdAt.toISOString(),
      }));
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[AUDIT_MULTIPLE_ERROR] ${error.message}`);
    }
  }
}
