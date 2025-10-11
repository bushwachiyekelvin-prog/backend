import { pgTable, text, timestamp, varchar, index, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { loanApplications } from "./loanApplications";

// Enum for audit trail actions
export const auditActionEnum = pgEnum("audit_action", [
  // Application lifecycle actions
  "application_created",
  "application_submitted",
  "application_under_review",
  "application_approved",
  "application_rejected",
  "application_withdrawn",
  "application_deleted",
  "application_disbursed",
  
  // Document actions
  "documents_uploaded",
  "documents_updated",
  "document_request_created",
  "document_request_fulfilled",
  
  // Offer letter actions
  "offer_letter_created",
  "offer_letter_generated",
  "offer_letter_sent",
  "offer_letter_delivered",
  "offer_letter_signed",
  "offer_letter_declined",
  "offer_letter_expired",
  "offer_letter_updated",
  
  // Status changes
  "status_updated",
  "snapshot_created",
  
  // Application status-specific actions
  "application_offer_letter_sent",
  "application_offer_letter_signed",
  "application_offer_letter_declined",
]);

/**
 * Application audit trail table
 *
 * Notes:
 * - Tracks all actions related to loan applications
 * - Provides complete audit trail for compliance
 * - Links to users and loan applications
 * - Stores action details and metadata
 */
export const applicationAuditTrail = pgTable(
  "application_audit_trail",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    
    // Core relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Action details
    action: auditActionEnum("action").notNull(),
    reason: text("reason"), // Optional reason for the action
    details: text("details"), // Additional details about the action
    
    // Metadata
    metadata: text("metadata"), // JSON string for additional data
    beforeData: text("before_data"), // JSON string of state before action
    afterData: text("after_data"), // JSON string of state after action
    
    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Primary lookup indexes
      idxAuditTrailLoanApplication: index("idx_audit_trail_loan_application").on(table.loanApplicationId),
      idxAuditTrailUser: index("idx_audit_trail_user").on(table.userId),
      idxAuditTrailAction: index("idx_audit_trail_action").on(table.action),
      idxAuditTrailCreatedAt: index("idx_audit_trail_created_at").on(table.createdAt),
      
      // Composite indexes for common queries
      idxAuditTrailLoanApplicationAction: index("idx_audit_trail_loan_application_action").on(
        table.loanApplicationId,
        table.action
      ),
      idxAuditTrailLoanApplicationCreated: index("idx_audit_trail_loan_application_created").on(
        table.loanApplicationId,
        table.createdAt
      ),
      idxAuditTrailUserCreated: index("idx_audit_trail_user_created").on(
        table.userId,
        table.createdAt
      ),
      
      // Additional performance indexes for common query patterns
      idxAuditTrailActionCreated: index("idx_audit_trail_action_created").on(
        table.action,
        table.createdAt
      ),
      idxAuditTrailLoanApplicationUser: index("idx_audit_trail_loan_application_user").on(
        table.loanApplicationId,
        table.userId
      ),
      idxAuditTrailLoanApplicationActionCreated: index("idx_audit_trail_loan_application_action_created").on(
        table.loanApplicationId,
        table.action,
        table.createdAt
      ),
    };
  },
);

// Type exports for use in application code
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
