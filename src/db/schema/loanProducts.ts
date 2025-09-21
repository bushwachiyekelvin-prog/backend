import { pgTable, text, timestamp, boolean, integer, numeric, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { pgEnum } from "drizzle-orm/pg-core";

// Enum for loan term unit granularity
// Use plural names to be explicit in meaning when reading rows
export const loanTermUnitEnum = pgEnum("loan_term_unit", [
  "days",
  "weeks",
  "months",
  "quarters",
  "years",
]);

// Enum for interest type; extend later if needed (e.g., reducing-balance vs flat)
export const interestTypeEnum = pgEnum("interest_type", [
  "fixed",
  "variable",
]);

// Enum to indicate the period unit the interest rate refers to
export const interestRatePeriodEnum = pgEnum("interest_rate_period", [
  "per_day",
  "per_month",
  "per_quarter",
  "per_year",
]);

// Enum for repayment frequency (e.g., how often repayments are made)
export const repaymentFrequencyEnum = pgEnum("repayment_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
]);

// Enum for amortization method
export const amortizationMethodEnum = pgEnum("amortization_method", [
  "flat",
  "reducing_balance",
]);

/**
 * Loan products master table
 *
 * Notes:
 * - interestRate is stored as a percentage value (e.g., 12.5 means 12.5%).
 * - minAmount/maxAmount are stored as NUMERIC(15,2) to support large currencies with cents.
 * - minTerm/maxTerm use the unit defined by termUnit (e.g., months).
 */
export const loanProducts = pgTable(
  "loan_products",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),

    // Identity & presentation
    name: varchar("name", { length: 150 }).notNull(),
    slug: varchar("slug", { length: 180 }),
    imageUrl: text("image_url"),
    summary: text("summary"),
    description: text("description"),

    // Monetary constraints & currency
    currency: varchar("currency", { length: 10 }).notNull(), // ISO 4217 preferred (e.g., "USD", "KES")
    minAmount: numeric("min_amount", { precision: 15, scale: 2 }).notNull(),
    maxAmount: numeric("max_amount", { precision: 15, scale: 2 }).notNull(),

    // Term constraints & unit
    minTerm: integer("min_term").notNull(),
    maxTerm: integer("max_term").notNull(),
    termUnit: loanTermUnitEnum("term_unit").notNull(),

    // Pricing
    interestRate: numeric("interest_rate", { precision: 7, scale: 4 }).notNull(), // percentage value
    interestType: interestTypeEnum("interest_type").default("fixed").notNull(),
    ratePeriod: interestRatePeriodEnum("rate_period").default("per_year").notNull(),
    amortizationMethod: amortizationMethodEnum("amortization_method").default("reducing_balance").notNull(),
    repaymentFrequency: repaymentFrequencyEnum("repayment_frequency").default("monthly").notNull(),
    // Fees (either flat amount or % of principal; all optional)
    processingFeeRate: numeric("processing_fee_rate", { precision: 7, scale: 4 }),
    processingFeeFlat: numeric("processing_fee_flat", { precision: 15, scale: 2 }),
    lateFeeRate: numeric("late_fee_rate", { precision: 7, scale: 4 }),
    lateFeeFlat: numeric("late_fee_flat", { precision: 15, scale: 2 }),
    prepaymentPenaltyRate: numeric("prepayment_penalty_rate", { precision: 7, scale: 4 }),
    gracePeriodDays: integer("grace_period_days").default(0).notNull(),

    // Lifecycle
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      uqLoanProductsName: uniqueIndex("uq_loan_products_name").on(table.name),
      idxLoanProductsCurrency: index("idx_loan_products_currency").on(table.currency),
      idxLoanProductsTermUnit: index("idx_loan_products_term_unit").on(table.termUnit),
      idxLoanProductsRatePeriod: index("idx_loan_products_rate_period").on(table.ratePeriod),
      idxLoanProductsRepaymentFrequency: index("idx_loan_products_repayment_frequency").on(table.repaymentFrequency),
      idxLoanProductsAmortization: index("idx_loan_products_amortization").on(table.amortizationMethod),
      idxLoanProductsActive: index("idx_loan_products_active").on(table.isActive),
      idxLoanProductsDeletedAt: index("idx_loan_products_deleted_at").on(table.deletedAt),
      idxLoanProductsCreatedAt: index("idx_loan_products_created_at").on(table.createdAt),
    };
  },
);
