import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { loanProducts } from "../../db/schema/loanProducts";
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
    isActive: r.isActive,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    updatedAt: r.updatedAt?.toISOString?.() ?? null,
  };
}

export abstract class LoanProductsService {
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

  static async list(clerkId: string): Promise<LoanProductsModel.ListLoanProductsResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const rows = await db
        .select()
        .from(loanProducts)
        .where(isNull(loanProducts.deletedAt));

      return {
        success: true,
        message: "Loan products retrieved successfully",
        data: rows.map(mapRow),
      };
    } catch (error: any) {
      logger.error("Error listing loan products:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_LOAN_PRODUCTS_ERROR] Failed to list loan products");
    }
  }

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
        .select({ id: loanProducts.id })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

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

  static async remove(
    clerkId: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const [existing] = await db
        .select({ id: loanProducts.id })
        .from(loanProducts)
        .where(and(eq(loanProducts.id, id), isNull(loanProducts.deletedAt)));
      if (!existing) throw httpError(404, "[LOAN_PRODUCT_NOT_FOUND] Loan product not found");

      await db
        .update(loanProducts)
        .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
        .where(eq(loanProducts.id, id));

      return { success: true, message: "Loan product deleted successfully" };
    } catch (error: any) {
      logger.error("Error deleting loan product:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_LOAN_PRODUCT_ERROR] Failed to delete loan product");
    }
  }
}
