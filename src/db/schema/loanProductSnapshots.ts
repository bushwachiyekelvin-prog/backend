import { pgTable, text, timestamp, varchar, index, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { loanApplications } from "./loanApplications";
import { loanProducts } from "./loanProducts";

/**
 * Loan product snapshots table
 * 
 * Stores immutable snapshots of loan products at the time of application creation.
 * This ensures that changes to loan products don't affect existing applications.
 * 
 * Notes:
 * - productSnapshot contains the complete product state as JSON
 * - createdAt is when the snapshot was taken (application creation time)
 * - This table provides audit trail and data integrity
 */
export const loanProductSnapshots = pgTable(
  "loan_product_snapshots",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    
    // Relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    loanProductId: varchar("loan_product_id", { length: 24 })
      .notNull()
      .references(() => loanProducts.id, { onDelete: "restrict" }),
    
    // Snapshot data
    productSnapshot: jsonb("product_snapshot").notNull(), // Complete product state
    productVersion: text("product_version").notNull(), // Version at time of snapshot
    
    // Metadata
    snapshotReason: text("snapshot_reason").default("application_creation"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Indexes for performance
      idxSnapshotsApplication: index("idx_snapshots_application").on(table.loanApplicationId),
      idxSnapshotsProduct: index("idx_snapshots_product").on(table.loanProductId),
      idxSnapshotsVersion: index("idx_snapshots_version").on(table.productVersion),
      idxSnapshotsCreatedAt: index("idx_snapshots_created_at").on(table.createdAt),
      
      // Composite indexes for common queries
      idxSnapshotsApplicationProduct: index("idx_snapshots_application_product").on(
        table.loanApplicationId,
        table.loanProductId
      ),
    };
  },
);

// Type for the product snapshot structure
export interface ProductSnapshot {
  // Core product fields
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  summary?: string;
  description?: string;
  
  // Monetary constraints
  currency: string;
  minAmount: number;
  maxAmount: number;
  
  // Term constraints
  minTerm: number;
  maxTerm: number;
  termUnit: string;
  
  // Pricing
  interestRate: number;
  interestType: string;
  ratePeriod: string;
  amortizationMethod: string;
  repaymentFrequency: string;
  
  // Fees
  processingFeeFlat?: number;
  lateFeeRate?: number;
  lateFeeFlat?: number;
  prepaymentPenaltyRate?: number;
  gracePeriodDays: number;
  
  // Versioning info
  version: number;
  status: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
}
