import { pgTable, text, timestamp, boolean, integer, numeric, varchar, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { loanApplications } from "./loanApplications";

// Enum for offer letter status
export const offerLetterStatusEnum = pgEnum("offer_letter_status", [
  "draft",
  "sent",
  "delivered",
  "viewed",
  "signed",
  "declined",
  "voided",
  "expired",
  "superseded", // When a new version replaces this one
]);

// Enum for DocuSign envelope status (matches DocuSign API statuses)
export const docuSignStatusEnum = pgEnum("docusign_status", [
  "not_sent",
  "sent",
  "delivered",
  "viewed",
  "completed",
  "declined",
  "voided",
  "expired",
  "auto_responded",
  "deferred",
  "fax_pending",
]);

/**
 * Offer letters table
 *
 * Notes:
 * - Separate table for managing loan offer letters and DocuSign integration
 * - Supports multiple versions/amendments of offers per loan application
 * - Tracks complete DocuSign workflow and document lifecycle
 * - Links to loan applications but manages its own lifecycle
 */
export const offerLetters = pgTable(
  "offer_letters",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    
    // Core relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    
    // Offer letter identification
    offerNumber: varchar("offer_number", { length: 50 }).notNull().unique(), // e.g., "OFFER-2024-001234"
    version: integer("version").default(1).notNull(), // For amendments/revisions
    
    // Loan offer terms (these may differ from original application)
    offerAmount: numeric("offer_amount", { precision: 15, scale: 2 }).notNull(),
    offerTerm: integer("offer_term").notNull(), // Term value in the product's term unit
    interestRate: numeric("interest_rate", { precision: 7, scale: 4 }).notNull(), // May differ from product rate
    currency: varchar("currency", { length: 10 }).notNull(),
    
    // Offer conditions and special terms
    specialConditions: text("special_conditions"), // JSON or text for any special terms
    requiresGuarantor: boolean("requires_guarantor").default(false).notNull(),
    requiresCollateral: boolean("requires_collateral").default(false).notNull(),
    
    // DocuSign integration
    docuSignEnvelopeId: varchar("docusign_envelope_id", { length: 100 }),
    docuSignStatus: docuSignStatusEnum("docusign_status").default("not_sent").notNull(),
    docuSignTemplateId: varchar("docusign_template_id", { length: 100 }), // Template used for this offer
    
    // Document URLs
    offerLetterUrl: text("offer_letter_url"), // Link to view the offer letter
    signedDocumentUrl: text("signed_document_url"), // Link to signed document
    
    // Recipients (who needs to sign)
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    recipientName: varchar("recipient_name", { length: 200 }).notNull(),
    
    // Timeline tracking
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    
    // Expiry and deadline management
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // When the offer expires
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }), // Last reminder sent
    
    // Status and workflow
    status: offerLetterStatusEnum("status").default("draft").notNull(),
    isActive: boolean("is_active").default(true).notNull(), // Only one active offer per application
    
    // Audit and tracking
    createdBy: varchar("created_by", { length: 24 }), // User ID who created the offer
    notes: text("notes"), // Internal notes about this offer
    
    // Standard lifecycle fields
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      // Unique constraints
      uqOfferLettersNumber: uniqueIndex("uq_offer_letters_number").on(table.offerNumber),
      
      // Primary lookup indexes
      idxOfferLettersLoanApplication: index("idx_offer_letters_loan_application").on(table.loanApplicationId),
      idxOfferLettersStatus: index("idx_offer_letters_status").on(table.status),
      idxOfferLettersDocuSignStatus: index("idx_offer_letters_docusign_status").on(table.docuSignStatus),
      
      // Workflow indexes
      idxOfferLettersActive: index("idx_offer_letters_active").on(table.isActive),
      idxOfferLettersExpiresAt: index("idx_offer_letters_expires_at").on(table.expiresAt),
      idxOfferLettersSentAt: index("idx_offer_letters_sent_at").on(table.sentAt),
      idxOfferLettersSignedAt: index("idx_offer_letters_signed_at").on(table.signedAt),
      
      // DocuSign indexes
      idxOfferLettersDocuSignEnvelope: index("idx_offer_letters_docusign_envelope").on(table.docuSignEnvelopeId),
      idxOfferLettersDocuSignTemplate: index("idx_offer_letters_docusign_template").on(table.docuSignTemplateId),
      
      // Soft delete indexes
      idxOfferLettersDeletedAt: index("idx_offer_letters_deleted_at").on(table.deletedAt),
      idxOfferLettersCreatedAt: index("idx_offer_letters_created_at").on(table.createdAt),
      
      // Composite indexes for common queries
      idxOfferLettersLoanApplicationActive: index("idx_offer_letters_loan_application_active").on(
        table.loanApplicationId,
        table.isActive
      ),
      idxOfferLettersLoanApplicationStatus: index("idx_offer_letters_loan_application_status").on(
        table.loanApplicationId,
        table.status
      ),
      idxOfferLettersLoanApplicationDeleted: index("idx_offer_letters_loan_application_deleted").on(
        table.loanApplicationId,
        table.deletedAt
      ),
      idxOfferLettersStatusActive: index("idx_offer_letters_status_active").on(table.status, table.isActive),
      
      // Unique constraint: only one active offer per loan application
      uqOfferLettersActivePerApplication: uniqueIndex("uq_offer_letters_active_per_application").on(
        table.loanApplicationId,
        table.isActive
      ),
    };
  },
);

// Type exports for use in application code
export type OfferLetterStatus = (typeof offerLetterStatusEnum.enumValues)[number];
export type DocuSignStatus = (typeof docuSignStatusEnum.enumValues)[number];
