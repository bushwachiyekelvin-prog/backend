import { pgTable, text, timestamp, varchar, index, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { loanApplications } from "./loanApplications";

// Enum for document request status
export const documentRequestStatusEnum = pgEnum("document_request_status", [
  "pending",
  "fulfilled",
  "overdue",
]);

// Enum for document types that can be requested
export const requestedDocumentTypeEnum = pgEnum("requested_document_type", [
  // Personal documents
  "national_id_front",
  "national_id_back",
  "passport_bio_page",
  "drivers_license",
  "utility_bill",
  "bank_statement",
  
  // Business documents
  "business_registration",
  "articles_of_association",
  "business_permit",
  "tax_registration_certificate",
  "certificate_of_incorporation",
  "tax_clearance_certificate",
  "partnership_deed",
  "memorandum_of_association",
  "business_plan",
  "pitch_deck",
  "annual_bank_statement",
  "audited_financial_statements",
  
  // Additional documents
  "other",
]);

/**
 * Document requests table
 *
 * Notes:
 * - Tracks document requests from admins to users
 * - Links to loan applications and users
 * - Tracks fulfillment status and timing
 * - Supports both personal and business documents
 */
export const documentRequests = pgTable(
  "document_requests",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    
    // Core relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    requestedBy: varchar("requested_by", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedFrom: varchar("requested_from", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Request details
    documentType: requestedDocumentTypeEnum("document_type").notNull(),
    description: text("description").notNull(), // What's needed and why
    isRequired: varchar("is_required", { length: 10 }).notNull().default("true"), // "true" or "false"
    
    // Status tracking
    status: documentRequestStatusEnum("status").notNull().default("pending"),
    
    // Fulfillment tracking
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    fulfilledWith: varchar("fulfilled_with", { length: 24 }), // Document ID that fulfilled the request
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Primary lookup indexes
      idxDocumentRequestsLoanApplication: index("idx_document_requests_loan_application").on(table.loanApplicationId),
      idxDocumentRequestsRequestedBy: index("idx_document_requests_requested_by").on(table.requestedBy),
      idxDocumentRequestsRequestedFrom: index("idx_document_requests_requested_from").on(table.requestedFrom),
      idxDocumentRequestsStatus: index("idx_document_requests_status").on(table.status),
      idxDocumentRequestsDocumentType: index("idx_document_requests_document_type").on(table.documentType),
      idxDocumentRequestsCreatedAt: index("idx_document_requests_created_at").on(table.createdAt),
      
      // Composite indexes for common queries
      idxDocumentRequestsLoanApplicationStatus: index("idx_document_requests_loan_application_status").on(
        table.loanApplicationId,
        table.status
      ),
      idxDocumentRequestsRequestedFromStatus: index("idx_document_requests_requested_from_status").on(
        table.requestedFrom,
        table.status
      ),
      idxDocumentRequestsLoanApplicationCreated: index("idx_document_requests_loan_application_created").on(
        table.loanApplicationId,
        table.createdAt
      ),
      
      // Additional performance indexes for common query patterns
      idxDocumentRequestsRequestedFromDocumentType: index("idx_document_requests_requested_from_document_type").on(
        table.requestedFrom,
        table.documentType
      ),
      idxDocumentRequestsStatusCreated: index("idx_document_requests_status_created").on(
        table.status,
        table.createdAt
      ),
      idxDocumentRequestsLoanApplicationStatusCreated: index("idx_document_requests_loan_application_status_created").on(
        table.loanApplicationId,
        table.status,
        table.createdAt
      ),
    };
  },
);

// Type exports for use in application code
export type DocumentRequestStatus = (typeof documentRequestStatusEnum.enumValues)[number];
export type RequestedDocumentType = (typeof requestedDocumentTypeEnum.enumValues)[number];
