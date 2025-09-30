import { and, eq, isNull, count, desc, or, asc, like, gte, lte, sql, ne } from "drizzle-orm";
import { db } from "../../db";
import { loanProducts, loanApplications } from "../../db/schema";
import { LoanProductsModel } from "./loan-products.model";
import { logger } from "../../utils/logger";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

type LoanProductRow = typeof loanProducts.$inferSelect;

function mapRow(r: LoanProductRow): LoanProductsModel.LoanProductItem {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    imageUrl: r.imageUrl,
    summary: r.summary,
    description: r.description,
    currency: r.currency,
    minAmount: toNumber(r.minAmount) ?? 0,
    maxAmount: toNumber(r.maxAmount) ?? 0,
    minTerm: r.minTerm,
    maxTerm: r.maxTerm,
    termUnit: r.termUnit,
    interestRate: toNumber(r.interestRate) ?? 0,
    interestType: r.interestType,
    ratePeriod: r.ratePeriod,
    amortizationMethod: r.amortizationMethod,
    repaymentFrequency: r.repaymentFrequency,
    processingFeeFlat: toNumber(r.processingFeeFlat) ?? null,
    lateFeeRate: toNumber(r.lateFeeRate) ?? null,
    lateFeeFlat: toNumber(r.lateFeeFlat) ?? null,
    prepaymentPenaltyRate: toNumber(r.prepaymentPenaltyRate) ?? null,
    gracePeriodDays: r.gracePeriodDays,
    // New versioning fields
    version: r.version ?? 1,
    status: r.status ?? "draft",
    changeReason: r.changeReason,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt?.toISOString?.() ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    updatedAt: r.updatedAt?.toISOString?.() ?? null,
  };
}

export abstract class LoanProductsService {
  /**
   * Create a new loan product
   * 
   * @description Creates a new loan product with draft status by default.
   * Products must be approved and activated before they can be used for applications.
   * 
   * @param clerkId - The ID of the user creating the product
   * @param body - Product creation data
   * @returns Created product with draft status
   * 
   * @throws {400} If product data is invalid
   * @throws {401} If user is not authorized
   * @throws {409} If product name already exists
   * @throws {500} If creation fails
   */
  static async create(
    clerkId: string,
    body: LoanProductsModel.CreateLoanProductBody,
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Basic guards beyond JSON Schema
      if (body.minAmount > body.maxAmount) {
        throw httpError(400, "[INVALID_AMOUNT_RANGE] minAmount cannot exceed maxAmount");
      }
      if (body.minTerm > body.maxTerm) {
        throw httpError(400, "[INVALID_TERM_RANGE] minTerm cannot exceed maxTerm");
      }

      const values = {
        name: body.name,
        slug: body.slug ?? null,
        imageUrl: body.imageUrl ?? null,
        summary: body.summary ?? null,
        description: body.description ?? null,
        currency: body.currency,
        minAmount: body.minAmount as any,
        maxAmount: body.maxAmount as any,
        minTerm: body.minTerm,
        maxTerm: body.maxTerm,
        termUnit: body.termUnit as any,
        interestRate: body.interestRate as any,
        interestType: (body.interestType ?? "fixed") as any,
        ratePeriod: (body.ratePeriod ?? "per_year") as any,
        amortizationMethod: (body.amortizationMethod ?? "reducing_balance") as any,
        repaymentFrequency: (body.repaymentFrequency ?? "monthly") as any,
        processingFeeRate: (body.processingFeeRate ?? null) as any,
        processingFeeFlat: (body.processingFeeFlat ?? null) as any,
        lateFeeRate: (body.lateFeeRate ?? null) as any,
        lateFeeFlat: (body.lateFeeFlat ?? null) as any,
        prepaymentPenaltyRate: (body.prepaymentPenaltyRate ?? null) as any,
        gracePeriodDays: body.gracePeriodDays ?? 0,
        // Versioning fields
        version: 1, // Always start with version 1
        status: (body.status ?? "draft") as any,
        changeReason: body.changeReason ?? null,
        approvedBy: null, // Will be set during approval
        approvedAt: null, // Will be set during approval
        isActive: body.isActive ?? true,
      };

      const [row] = await db
        .insert(loanProducts)
        .values(values)
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error creating loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_LOAN_PRODUCT_ERROR] Failed to create loan product");
    }
  }

  /**
   * List loan products with comprehensive filtering and pagination
   * 
   * @description Retrieves loan products with advanced filtering, sorting, and pagination.
   * Supports filtering by status, currency, amount ranges, terms, and search functionality.
   * 
   * Product Status Rules:
   * - draft: Being configured, not available for applications
   * - active: Available for new loan applications
   * - archived: Historical record only, no new applications
   * 
   * @param clerkId - The ID of the user requesting the list
   * @param query - Comprehensive filtering and pagination parameters
   * @param query.page - Page number (default: 1)
   * @param query.limit - Items per page (default: 20, max: 100)
   * @param query.status - Filter by product status
   * @param query.includeArchived - Include archived products (default: false)
   * @param query.currency - Filter by currency
   * @param query.minAmount - Filter by minimum amount
   * @param query.maxAmount - Filter by maximum amount
   * @param query.minTerm - Filter by minimum term
   * @param query.maxTerm - Filter by maximum term
   * @param query.termUnit - Filter by term unit
   * @param query.interestType - Filter by interest type
   * @param query.ratePeriod - Filter by rate period
   * @param query.amortizationMethod - Filter by amortization method
   * @param query.repaymentFrequency - Filter by repayment frequency
   * @param query.isActive - Filter by active status
   * @param query.search - Search in name and description
   * @param query.sortBy - Sort field (default: createdAt)
   * @param query.sortOrder - Sort order (default: desc)
   * @returns Paginated list of products matching the criteria
   * 
   * @throws {401} If user is not authorized
   * @throws {500} If listing fails
   */
  static async list(
    clerkId: string, 
    query: LoanProductsModel.ListLoanProductsQuery = {}
  ): Promise<LoanProductsModel.ListLoanProductsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Parse pagination parameters
      const page = query.page ? parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? parseInt(query.limit) : 20, 100); // Max 100 items per page
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [isNull(loanProducts.deletedAt)];

      // Status filtering
      if (query.status) {
        whereConditions.push(eq(loanProducts.status, query.status));
      } else if (query.includeArchived !== "true") {
        // By default, exclude archived products unless explicitly requested
        whereConditions.push(ne(loanProducts.status, "archived"));
      }

      // Currency filtering
      if (query.currency) {
        whereConditions.push(eq(loanProducts.currency, query.currency));
      }

      // Amount range filtering
      if (query.minAmount) {
        whereConditions.push(gte(loanProducts.minAmount, query.minAmount));
      }
      if (query.maxAmount) {
        whereConditions.push(lte(loanProducts.maxAmount, query.maxAmount));
      }

      // Term range filtering
      if (query.minTerm) {
        whereConditions.push(gte(loanProducts.minTerm, parseInt(query.minTerm)));
      }
      if (query.maxTerm) {
        whereConditions.push(lte(loanProducts.maxTerm, parseInt(query.maxTerm)));
      }

      // Term unit filtering
      if (query.termUnit) {
        whereConditions.push(eq(loanProducts.termUnit, query.termUnit));
      }

      // Interest type filtering
      if (query.interestType) {
        whereConditions.push(eq(loanProducts.interestType, query.interestType));
      }

      // Rate period filtering
      if (query.ratePeriod) {
        whereConditions.push(eq(loanProducts.ratePeriod, query.ratePeriod));
      }

      // Amortization method filtering
      if (query.amortizationMethod) {
        whereConditions.push(eq(loanProducts.amortizationMethod, query.amortizationMethod));
      }

      // Repayment frequency filtering
      if (query.repaymentFrequency) {
        whereConditions.push(eq(loanProducts.repaymentFrequency, query.repaymentFrequency));
      }

      // Active status filtering
      if (query.isActive !== undefined) {
        const isActive = query.isActive === "true";
        whereConditions.push(eq(loanProducts.isActive, isActive));
      }

      // Search functionality
      if (query.search) {
        const searchTerm = `%${query.search}%`;
        const searchCondition = or(
          like(loanProducts.name, searchTerm),
          like(loanProducts.description, searchTerm),
          like(loanProducts.summary, searchTerm)
        );
        if (searchCondition) {
          whereConditions.push(searchCondition);
        }
      }

      // Get total count for pagination
      const [{ total }] = await db
        .select({ total: count() })
        .from(loanProducts)
        .where(and(...whereConditions));

      // Build sorting
      const sortBy = query.sortBy || "createdAt";
      const sortOrder = query.sortOrder || "desc";
      
      let orderByClause;
      switch (sortBy) {
        case "name":
          orderByClause = sortOrder === "asc" ? asc(loanProducts.name) : desc(loanProducts.name);
          break;
        case "interestRate":
          orderByClause = sortOrder === "asc" ? asc(loanProducts.interestRate) : desc(loanProducts.interestRate);
          break;
        case "minAmount":
          orderByClause = sortOrder === "asc" ? asc(loanProducts.minAmount) : desc(loanProducts.minAmount);
          break;
        case "maxAmount":
          orderByClause = sortOrder === "asc" ? asc(loanProducts.maxAmount) : desc(loanProducts.maxAmount);
          break;
        case "updatedAt":
          orderByClause = sortOrder === "asc" ? asc(loanProducts.updatedAt) : desc(loanProducts.updatedAt);
          break;
        default: // createdAt
          orderByClause = sortOrder === "asc" ? asc(loanProducts.createdAt) : desc(loanProducts.createdAt);
      }

      // Get paginated results
      const rows = await db
        .select()
        .from(loanProducts)
        .where(and(...whereConditions))
        .orderBy(orderByClause)
        .limit(limit)
        .offset(offset);

      return {
        success: true,
        message: "Loan products retrieved successfully",
        data: rows.map(mapRow),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing loan products:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_LOAN_PRODUCTS_ERROR] Failed to list loan products");
    }
  }

  /**
   * Get a loan product by ID
   * 
   * @description Retrieves a specific loan product by its ID.
   * Returns the product regardless of status (including archived).
   * 
   * @param clerkId - The ID of the user requesting the product
   * @param id - The product ID
   * @returns The requested product
   * 
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {500} If retrieval fails
   */
  static async getById(
    clerkId: string,
    id: string,
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [row] = await db
        .select()
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)))
        .limit(1);
      if (!row) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");
      return mapRow(row);
    } catch (error: any) {
      logger.error("Error getting loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_LOAN_PRODUCT_ERROR] Failed to get loan product");
    }
  }

  /**
   * Update a loan product
   * 
   * @description Updates an existing loan product. The ability to edit depends on the product's status:
   * 
   * Edit Rules by Status:
   * - draft: ✅ Can edit all fields (name, rates, terms, etc.)
   * - active: ✅ Can edit all fields with automatic versioning for critical changes
   * - archived: ❌ Cannot edit - read-only historical record
   * 
   * For active products, critical field changes (rates, terms) automatically increment version.
   * Existing applications are protected by immutable snapshots, so changes are safe.
   * 
   * @param clerkId - The ID of the user updating the product
   * @param id - The product ID
   * @param body - Updated product data
   * @returns Updated product
   * 
   * @throws {400} If update data is invalid or violates edit rules
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {409} If product name already exists
   * @throws {500} If update fails
   */
  static async update(
    clerkId: string,
    id: string,
    body: LoanProductsModel.EditLoanProductBody,
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      if (
        body.minAmount !== undefined &&
        body.maxAmount !== undefined &&
        body.minAmount > body.maxAmount
      ) {
        throw httpError(400, "[INVALID_AMOUNT_RANGE] minAmount cannot exceed maxAmount");
      }
      if (
        body.minTerm !== undefined &&
        body.maxTerm !== undefined &&
        body.minTerm > body.maxTerm
      ) {
        throw httpError(400, "[INVALID_TERM_RANGE] minTerm cannot exceed maxTerm");
      }

      const [existing] = await db
        .select({ 
          id: loanProducts.id, 
          status: loanProducts.status,
          name: loanProducts.name 
        })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Validate edit permissions based on status
      if (existing.status === "archived") {
        throw httpError(400, "[PRODUCT_ARCHIVED] Cannot edit archived products - they are read-only historical records");
      }

      // Check for critical field changes on active products (for versioning)
      let shouldIncrementVersion = false;
      if (existing.status === "active") {
        const criticalFields = ['minAmount', 'maxAmount', 'minTerm', 'maxTerm', 'interestRate', 'interestType', 'ratePeriod', 'amortizationMethod', 'repaymentFrequency'];
        shouldIncrementVersion = criticalFields.some(field => body[field as keyof typeof body] !== undefined);
        
        if (shouldIncrementVersion) {
          logger.info(`[PRODUCT_VERSION_INCREMENT] Critical field change detected for product ${id} (${existing.name}). Version will be incremented.`);
        }
      }

      // Get current version for incrementing
      const [currentProduct] = await db
        .select({ version: loanProducts.version })
        .from(loanProducts)
        .where(eq(loanProducts.id, id));

      const [row] = await db
        .update(loanProducts)
        .set({
          name: body.name ?? undefined,
          slug: body.slug ?? undefined,
          imageUrl: body.imageUrl ?? undefined,
          summary: body.summary ?? undefined,
          description: body.description ?? undefined,
          currency: body.currency ?? undefined,
          minAmount: (body.minAmount as any) ?? undefined,
          maxAmount: (body.maxAmount as any) ?? undefined,
          minTerm: body.minTerm ?? undefined,
          maxTerm: body.maxTerm ?? undefined,
          termUnit: (body.termUnit as any) ?? undefined,
          interestRate: (body.interestRate as any) ?? undefined,
          interestType: (body.interestType as any) ?? undefined,
          ratePeriod: (body.ratePeriod as any) ?? undefined,
          amortizationMethod: (body.amortizationMethod as any) ?? undefined,
          repaymentFrequency: (body.repaymentFrequency as any) ?? undefined,
          processingFeeFlat: (body.processingFeeFlat as any) ?? undefined,
          lateFeeRate: (body.lateFeeRate as any) ?? undefined,
          lateFeeFlat: (body.lateFeeFlat as any) ?? undefined,
          prepaymentPenaltyRate: (body.prepaymentPenaltyRate as any) ?? undefined,
          gracePeriodDays: body.gracePeriodDays ?? undefined,
          // Versioning fields
          version: shouldIncrementVersion ? (currentProduct?.version ?? 1) + 1 : undefined,
          changeReason: body.changeReason ?? undefined,
          isActive: body.isActive ?? undefined,
          updatedAt: new Date(),
        })
        .where(eq(loanProducts.id, id))
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error updating loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_LOAN_PRODUCT_ERROR] Failed to update loan product");
    }
  }

  /**
   * Soft delete a loan product
   * 
   * @description Soft deletes a loan product by setting deletedAt timestamp.
   * The product becomes unavailable for new applications but existing applications continue to work.
   * 
   * Deletion Rules by Status:
   * - draft: ✅ Can delete (no applications exist)
   * - active: ⚠️ Can delete but check for existing applications first
   * - archived: ✅ Can delete (already archived)
   * 
   * @param clerkId - The ID of the user deleting the product
   * @param id - The product ID
   * @returns Success message
   * 
   * @throws {400} If product has active applications
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {500} If deletion fails
   */
  static async remove(
    clerkId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({ 
          id: loanProducts.id, 
          status: loanProducts.status 
        })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Check for existing applications (only for active products)
      if (existing.status === "active") {
        const [applicationCount] = await db
          .select({ count: count() })
          .from(loanApplications)
          .where(and(
            eq(loanApplications.loanProductId, id),
            or(
              eq(loanApplications.status, "submitted"),
              eq(loanApplications.status, "under_review"),
              eq(loanApplications.status, "approved"),
              eq(loanApplications.status, "offer_letter_sent"),
              eq(loanApplications.status, "offer_letter_signed"),
              eq(loanApplications.status, "disbursed")
            )
          ));

        if (applicationCount.count > 0) {
          throw httpError(400, `[PRODUCT_HAS_APPLICATIONS] Cannot delete product with ${applicationCount.count} active applications. Archive the product instead.`);
        }
      }

      await db
        .update(loanProducts)
        .set({ 
          deletedAt: new Date(), 
          isActive: false, 
          status: "archived" as any,
          updatedAt: new Date() 
        })
        .where(eq(loanProducts.id, id));

      return { success: true, message: "Loan product deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_LOAN_PRODUCT_ERROR] Failed to delete loan product");
    }
  }

  /**
   * Update product status
   * 
   * @description Changes the status of a loan product. This is the primary way to manage product lifecycle.
   * 
   * Note: Reactivation of archived products is safe due to immutable snapshots. Each application
   * maintains its own snapshot of the product state at the time of application, ensuring data integrity.
   * 
   * Status Transition Rules:
   * - draft → active: ✅ Product becomes available for applications (requires approval)
   * - active → archived: ✅ Product becomes read-only historical record
   * - archived → active: ✅ Can reactivate with proper approval and audit logging
   * - Any status → draft: ❌ Cannot revert to draft once approved
   * 
   * @param clerkId - The ID of the user changing the status
   * @param id - The product ID
   * @param newStatus - The new status to set
   * @param changeReason - Required reason for the status change
   * @param approvedBy - The ID of the user approving the change
   * @returns Updated product
   * 
   * @throws {400} If status transition is invalid
   * @throws {401} If user is not authorized
   * @throws {404} If product is not found
   * @throws {500} If status update fails
   */
  static async updateStatus(
    clerkId: string,
    id: string,
    newStatus: LoanProductsModel.ProductStatus,
    changeReason: string,
    approvedBy: string
  ): Promise<LoanProductsModel.LoanProductItem> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");
      if (!changeReason) throw httpError(400, "[MISSING_REASON] Change reason is required for status updates");
      if (!approvedBy) throw httpError(400, "[MISSING_APPROVER] Approver ID is required for status updates");

      const [existing] = await db
        .select({ 
          id: loanProducts.id, 
          status: loanProducts.status,
          name: loanProducts.name,
          version: loanProducts.version
        })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      // Validate status transition
      const currentStatus = existing.status;
      const validTransitions: Record<string, string[]> = {
        "draft": ["active"],
        "active": ["archived"],
        "archived": ["active"] // Can reactivate with proper approval
      };

      if (!validTransitions[currentStatus]?.includes(newStatus)) {
        throw httpError(400, `[INVALID_TRANSITION] Cannot change status from ${currentStatus} to ${newStatus}. Valid transitions: ${validTransitions[currentStatus]?.join(", ") || "none"}`);
      }

      // Special validation for archiving
      if (newStatus === "archived") {
        const [applicationCount] = await db
          .select({ count: count() })
          .from(loanApplications)
          .where(and(
            eq(loanApplications.loanProductId, id),
            or(
              eq(loanApplications.status, "submitted"),
              eq(loanApplications.status, "under_review"),
              eq(loanApplications.status, "approved"),
              eq(loanApplications.status, "offer_letter_sent"),
              eq(loanApplications.status, "offer_letter_signed"),
              eq(loanApplications.status, "disbursed")
            )
          ));

        if (applicationCount.count > 0) {
          throw httpError(400, `[PRODUCT_HAS_APPLICATIONS] Cannot archive product with ${applicationCount.count} active applications. Wait for applications to complete.`);
        }
      }

      // Special validation for reactivation (archived → active)
      if (newStatus === "active" && currentStatus === "archived") {
        // Check for any applications that might be affected by reactivation
        // Since we have snapshots, this is mainly for business logic validation
        const [applicationCount] = await db
          .select({ count: count() })
          .from(loanApplications)
          .where(and(
            eq(loanApplications.loanProductId, id),
            or(
              eq(loanApplications.status, "submitted"),
              eq(loanApplications.status, "under_review"),
              eq(loanApplications.status, "approved"),
              eq(loanApplications.status, "offer_letter_sent"),
              eq(loanApplications.status, "offer_letter_signed"),
              eq(loanApplications.status, "disbursed")
            )
          ));

        // Log reactivation for audit trail
        logger.info(`[PRODUCT_REACTIVATION] Product ${id} (${existing.name}) reactivated by ${approvedBy}. Reason: ${changeReason}. Active applications: ${applicationCount.count}`);
        
        // Note: We allow reactivation even with active applications because:
        // 1. Each application has its own immutable snapshot
        // 2. New applications will use the current product state
        // 3. Existing applications remain unaffected
      }

      const [row] = await db
        .update(loanProducts)
        .set({
          status: newStatus as any,
          changeReason,
          approvedBy,
          approvedAt: new Date(),
          version: newStatus === "active" && currentStatus === "draft" ? (existing.version ?? 1) + 1 : (existing.version ?? 1), // Increment version on activation
          updatedAt: new Date()
        })
        .where(eq(loanProducts.id, id))
        .returning();

      return mapRow(row);
    } catch (error: any) {
      logger.error("Error updating product status:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_PRODUCT_STATUS_ERROR] Failed to update product status");
    }
  }

  /**
   * Get products available for applications
   * 
   * @description Returns only products that are available for new loan applications.
   * This excludes draft, archived, and deleted products.
   * 
   * @param clerkId - The ID of the user requesting available products
   * @returns List of products available for applications
   * 
   * @throws {401} If user is not authorized
   * @throws {500} If retrieval fails
   */
  static async getAvailableForApplications(clerkId: string): Promise<LoanProductsModel.ListLoanProductsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const rows = await db
        .select()
        .from(loanProducts)
        .where(and(
          isNull(loanProducts.deletedAt),
          eq(loanProducts.status, "active")
        ))
        .orderBy(desc(loanProducts.createdAt));

      return {
        success: true,
        message: "Available loan products retrieved successfully",
        data: rows.map(mapRow),
      };
    } catch (error: any) {
      logger.error("Error getting available products:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_AVAILABLE_PRODUCTS_ERROR] Failed to get available products");
    }
  }
}
