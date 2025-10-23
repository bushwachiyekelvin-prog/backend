import {
  type loanProducts,
  loanTermUnitEnum,
  interestTypeEnum,
  interestRatePeriodEnum,
  repaymentFrequencyEnum,
  amortizationMethodEnum,
  productStatusEnum,
} from "../../db/schema";

export namespace LoanProductsModel {
  // Term unit values derived from DB enum
  export const LoanTermUnitEnum = loanTermUnitEnum.enumValues;
  export type LoanTermUnit = (typeof loanProducts.$inferSelect)["termUnit"];

  // Interest type values derived from DB enum
  export const InterestTypeEnum = interestTypeEnum.enumValues;
  export type InterestType = (typeof loanProducts.$inferSelect)["interestType"];

  // Additional pricing enums
  export const InterestRatePeriodEnum = interestRatePeriodEnum.enumValues;
  export type InterestRatePeriod = (typeof loanProducts.$inferSelect)["ratePeriod"];
  export const RepaymentFrequencyEnum = repaymentFrequencyEnum.enumValues;
  export type RepaymentFrequency = (typeof loanProducts.$inferSelect)["repaymentFrequency"];
  export const AmortizationMethodEnum = amortizationMethodEnum.enumValues;
  export type AmortizationMethod = (typeof loanProducts.$inferSelect)["amortizationMethod"];

  // Product status values derived from DB enum
  export const ProductStatusEnum = productStatusEnum.enumValues;
  export type ProductStatus = (typeof loanProducts.$inferSelect)["status"];

  // Create product input
  export interface CreateLoanProductBody {
    name: string;
    slug?: string;
    imageUrl?: string;
    summary?: string;
    description?: string;
    currency: string; // ISO 4217 preferred
    minAmount: number; // decimal
    maxAmount: number; // decimal
    minTerm: number;   // integer, in termUnit
    maxTerm: number;   // integer, in termUnit
    termUnit: LoanTermUnit;
    interestRate: number; // percentage value (e.g., 12.5)
    interestType?: InterestType; // default: fixed
    ratePeriod?: InterestRatePeriod; // default: per_year
    amortizationMethod?: AmortizationMethod; // default: reducing_balance
    repaymentFrequency?: RepaymentFrequency; // default: monthly
    processingFeeRate?: number; // optional %
    processingFeeFlat?: number; // optional flat amount
    lateFeeRate?: number; // optional %
    lateFeeFlat?: number; // optional flat amount
    prepaymentPenaltyRate?: number; // optional %
    gracePeriodDays?: number; // default 0
    status?: ProductStatus; // default: draft
    changeReason?: string; // Required for status changes
    isActive?: boolean;
  }

  // Edit product input (partial)
  export interface EditLoanProductBody {
    name?: string;
    slug?: string;
    imageUrl?: string;
    summary?: string;
    description?: string;
    currency?: string;
    minAmount?: number;
    maxAmount?: number;
    minTerm?: number;
    maxTerm?: number;
    termUnit?: LoanTermUnit;
    interestRate?: number;
    interestType?: InterestType;
    ratePeriod?: InterestRatePeriod;
    amortizationMethod?: AmortizationMethod;
    repaymentFrequency?: RepaymentFrequency;
    processingFeeRate?: number;
    processingFeeFlat?: number;
    lateFeeRate?: number;
    lateFeeFlat?: number;
    prepaymentPenaltyRate?: number;
    gracePeriodDays?: number;
    status?: ProductStatus;
    changeReason?: string;
    isActive?: boolean;
  }

  // Params with :id
  export interface LoanProductIdParams { id: string; }

  // Query parameters for listing products
  export interface ListLoanProductsQuery {
    page?: string;
    limit?: string;
    status?: ProductStatus;
    includeArchived?: string;
    currency?: string;
    minAmount?: string;
    maxAmount?: string;
    minTerm?: string;
    maxTerm?: string;
    termUnit?: LoanTermUnit;
    interestType?: InterestType;
    ratePeriod?: InterestRatePeriod;
    amortizationMethod?: AmortizationMethod;
    repaymentFrequency?: RepaymentFrequency;
    isActive?: string;
    search?: string; // Search in name, description
    sortBy?: "name" | "createdAt" | "updatedAt" | "interestRate" | "minAmount" | "maxAmount";
    sortOrder?: "asc" | "desc";
  }

  // JSON Schemas
  export const CreateLoanProductBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 150 },
      slug: { type: "string" },
      imageUrl: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      currency: { type: "string", minLength: 1, maxLength: 10 },
      minAmount: { type: "number", minimum: 0 },
      maxAmount: { type: "number", minimum: 0 },
      minTerm: { type: "integer", minimum: 0 },
      maxTerm: { type: "integer", minimum: 0 },
      termUnit: { type: "string", enum: LoanTermUnitEnum },
      interestRate: { type: "number", minimum: 0 },
      interestType: { type: "string", enum: InterestTypeEnum },
      ratePeriod: { type: "string", enum: InterestRatePeriodEnum },
      amortizationMethod: { type: "string", enum: AmortizationMethodEnum },
      repaymentFrequency: { type: "string", enum: RepaymentFrequencyEnum },
      processingFeeRate: { type: "number", minimum: 0 },
      processingFeeFlat: { type: "number", minimum: 0 },
      lateFeeRate: { type: "number", minimum: 0 },
      lateFeeFlat: { type: "number", minimum: 0 },
    prepaymentPenaltyRate: { type: "number", minimum: 0 },
    gracePeriodDays: { type: "integer", minimum: 0 },
    status: { type: "string", enum: ProductStatusEnum },
    changeReason: { type: "string", minLength: 1, maxLength: 500 },
    isActive: { type: "boolean" },
    },
    required: [
      "name",
      "currency",
      "minAmount",
      "maxAmount",
      "minTerm",
      "maxTerm",
      "termUnit",
      "interestRate",
    ],
    allOf: [
      // Ensure minAmount <= maxAmount
      {
        if: { properties: { minAmount: { type: "number" }, maxAmount: { type: "number" } } },
        then: {
          properties: {
            maxAmount: { type: "number", minimum: { $data: "1/minAmount" } },
          },
        },
      },
      // Ensure minTerm <= maxTerm
      {
        if: { properties: { minTerm: { type: "integer" }, maxTerm: { type: "integer" } } },
        then: {
          properties: {
            maxTerm: { type: "integer", minimum: { $data: "1/minTerm" } },
          },
        },
      },
    ],
  } as const;

  export const EditLoanProductBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: CreateLoanProductBodySchema.properties,
    allOf: CreateLoanProductBodySchema.allOf,
  } as const;

  export interface LoanProductItem {
    id: string;
    name: string;
    slug?: string | null;
    imageUrl?: string | null;
    summary?: string | null;
    description?: string | null;
    currency: string;
    minAmount: number;
    maxAmount: number;
    minTerm: number;
    maxTerm: number;
    termUnit: LoanTermUnit;
    interestRate: number;
    interestType: InterestType;
    ratePeriod: InterestRatePeriod;
    amortizationMethod: AmortizationMethod;
    repaymentFrequency: RepaymentFrequency;
    processingFeeRate?: number | null;
    processingFeeFlat?: number | null;
    lateFeeRate?: number | null;
    lateFeeFlat?: number | null;
    prepaymentPenaltyRate?: number | null;
    gracePeriodDays: number;
    // Versioning fields
    version: number;
    status: ProductStatus;
    changeReason?: string | null;
    approvedBy?: string | null;
    approvedAt?: string | null;
    isActive: boolean;
    createdAt?: string | null;
    updatedAt?: string | null;
  }

  export const LoanProductItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      slug: { type: "string" },
      imageUrl: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      currency: { type: "string" },
      minAmount: { type: "number" },
      maxAmount: { type: "number" },
      minTerm: { type: "integer" },
      maxTerm: { type: "integer" },
      termUnit: { type: "string", enum: LoanTermUnitEnum },
      interestRate: { type: "number" },
      interestType: { type: "string", enum: InterestTypeEnum },
      ratePeriod: { type: "string", enum: InterestRatePeriodEnum },
      amortizationMethod: { type: "string", enum: AmortizationMethodEnum },
      repaymentFrequency: { type: "string", enum: RepaymentFrequencyEnum },
      processingFeeRate: { type: "number" },
      processingFeeFlat: { type: "number" },
      lateFeeRate: { type: "number" },
      lateFeeFlat: { type: "number" },
      prepaymentPenaltyRate: { type: "number" },
      gracePeriodDays: { type: "integer" },
      // Versioning fields
      version: { type: "integer" },
      status: { type: "string", enum: ProductStatusEnum },
      changeReason: { type: "string" },
      approvedBy: { type: "string" },
      approvedAt: { type: "string" },
      isActive: { type: "boolean" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: [
      "id",
      "name",
      "currency",
      "minAmount",
      "maxAmount",
      "minTerm",
      "maxTerm",
      "termUnit",
      "interestRate",
      "interestType",
      "ratePeriod",
      "amortizationMethod",
      "repaymentFrequency",
      "gracePeriodDays",
      "version",
      "status",
      "isActive",
    ],
    additionalProperties: true,
  } as const;

  export interface ListLoanProductsResponse {
    success: boolean;
    message: string;
    data: LoanProductItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export const ListLoanProductsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: LoanProductItemSchema },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
        required: ["page", "limit", "total", "totalPages"],
      },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
