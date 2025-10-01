import { pgTable, text, timestamp, boolean, integer, numeric, varchar, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { businessProfiles } from "./businessProfiles";
import { loanProducts } from "./loanProducts";

// Enum for loan application status
export const loanApplicationStatusEnum = pgEnum("loan_application_status", [
  "submitted",
  "under_review",
  "approved",
  "offer_letter_sent",
  "offer_letter_signed",
  "disbursed",
  "rejected",
  "withdrawn",
  "expired",
]);

// Enum for loan purpose
export const loanPurposeEnum = pgEnum("loan_purpose", [
  "working_capital",
  "business_expansion",
  "equipment_purchase",
  "inventory_financing",
  "debt_consolidation",
  "seasonal_financing",
  "emergency_funding",
  "other",
]);


/**
 * Loan applications table
 *
 * Notes:
 * - Links users (applicants) to businesses and loan products
 * - Tracks the complete loan application lifecycle
 * - Integrates with DocuSign for offer letter signing
 * - Supports both business and personal loans
 */
export const loanApplications = pgTable(
  "loan_applications",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    
    // Application identification
    applicationNumber: varchar("application_number", { length: 50 }).notNull().unique(),
    
    // Core relationships
    userId: varchar("user_id", { length: 24 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: varchar("business_id", { length: 24 }).references(() => businessProfiles.id, { onDelete: "cascade" }),
    loanProductId: varchar("loan_product_id", { length: 24 }).notNull().references(() => loanProducts.id, { onDelete: "restrict" }),
    
    // Co-applicants (stored as comma-separated user IDs)
    coApplicantIds: text("co_applicant_ids"), // JSON array of user IDs
    
    // Loan details
    loanAmount: numeric("loan_amount", { precision: 15, scale: 2 }).notNull(),
    loanTerm: integer("loan_term").notNull(), // Term value in the product's term unit
    currency: varchar("currency", { length: 10 }).notNull(), // Must match loan product
    purpose: loanPurposeEnum("purpose").notNull(),
    purposeDescription: text("purpose_description"), // Additional details if "other"
    
    // Application status and workflow
    status: loanApplicationStatusEnum("status").default("submitted").notNull(),
    isBusinessLoan: boolean("is_business_loan").default(false).notNull(),
    
    
    // Timeline tracking
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    
    // Rejection reason (if applicable)
    rejectionReason: text("rejection_reason"),
    
    // Enhanced status tracking for audit trail
    statusReason: text("status_reason"), // Reason for current status
    lastUpdatedBy: varchar("last_updated_by", { length: 24 }).references(() => users.id), // User who last updated
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow(), // When last updated
    
    // Standard lifecycle fields
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      // Unique constraints
      uqLoanApplicationsNumber: uniqueIndex("uq_loan_applications_number").on(table.applicationNumber),
      
      // Primary lookup indexes
      idxLoanApplicationsUser: index("idx_loan_applications_user").on(table.userId),
      idxLoanApplicationsBusiness: index("idx_loan_applications_business").on(table.businessId),
      idxLoanApplicationsLoanProduct: index("idx_loan_applications_loan_product").on(table.loanProductId),
      idxLoanApplicationsStatus: index("idx_loan_applications_status").on(table.status),
      
      // Workflow indexes
      idxLoanApplicationsSubmittedAt: index("idx_loan_applications_submitted_at").on(table.submittedAt),
      
      
      // Business vs personal loan index
      idxLoanApplicationsIsBusinessLoan: index("idx_loan_applications_is_business_loan").on(table.isBusinessLoan),
      
      // Soft delete indexes
      idxLoanApplicationsDeletedAt: index("idx_loan_applications_deleted_at").on(table.deletedAt),
      idxLoanApplicationsCreatedAt: index("idx_loan_applications_created_at").on(table.createdAt),
      
      // Composite indexes for common queries
      idxLoanApplicationsUserStatus: index("idx_loan_applications_user_status").on(table.userId, table.status),
      idxLoanApplicationsBusinessStatus: index("idx_loan_applications_business_status").on(table.businessId, table.status),
      idxLoanApplicationsUserDeleted: index("idx_loan_applications_user_deleted").on(table.userId, table.deletedAt),
      idxLoanApplicationsBusinessDeleted: index("idx_loan_applications_business_deleted").on(table.businessId, table.deletedAt),
      idxLoanApplicationsStatusDeleted: index("idx_loan_applications_status_deleted").on(table.status, table.deletedAt),
      
      // Enhanced status tracking indexes
      idxLoanApplicationsLastUpdatedBy: index("idx_loan_applications_last_updated_by").on(table.lastUpdatedBy),
      idxLoanApplicationsLastUpdatedAt: index("idx_loan_applications_last_updated_at").on(table.lastUpdatedAt),
    };
  },
);

// Type exports for use in application code
export type LoanApplicationStatus = (typeof loanApplicationStatusEnum.enumValues)[number];
export type LoanPurpose = (typeof loanPurposeEnum.enumValues)[number];
