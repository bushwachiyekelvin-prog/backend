import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { loanApplications } from "./loanApplications";

/**
 * Loan application snapshots table
 *
 * Notes:
 * - Creates immutable snapshots at loan approval points
 * - Contains complete state of application, documents, and business profile
 * - Used for compliance and audit purposes
 * - Single snapshot per loan application at approval time
 */
export const loanApplicationSnapshots = pgTable(
  "loan_application_snapshots",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    
    // Core relationships
    loanApplicationId: varchar("loan_application_id", { length: 24 })
      .notNull()
      .references(() => loanApplications.id, { onDelete: "cascade" }),
    createdBy: varchar("created_by", { length: 24 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    
    // Snapshot data
    snapshotData: text("snapshot_data").notNull(), // JSON string containing complete state
    
    // Approval stage
    approvalStage: varchar("approval_stage", { length: 50 }).notNull().default("loan_approved"),
    
    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      // Primary lookup indexes
      idxLoanApplicationSnapshotsLoanApplication: index("idx_loan_application_snapshots_loan_application").on(table.loanApplicationId),
      idxLoanApplicationSnapshotsCreatedBy: index("idx_loan_application_snapshots_created_by").on(table.createdBy),
      idxLoanApplicationSnapshotsApprovalStage: index("idx_loan_application_snapshots_approval_stage").on(table.approvalStage),
      idxLoanApplicationSnapshotsCreatedAt: index("idx_loan_application_snapshots_created_at").on(table.createdAt),
      
      // Composite indexes for common queries
      idxLoanApplicationSnapshotsLoanApplicationCreated: index("idx_loan_application_snapshots_loan_application_created").on(
        table.loanApplicationId,
        table.createdAt
      ),
      idxLoanApplicationSnapshotsCreatedByCreated: index("idx_loan_application_snapshots_created_by_created").on(
        table.createdBy,
        table.createdAt
      ),
      
      // Additional performance indexes for common query patterns
      idxLoanApplicationSnapshotsLoanApplicationApprovalStage: index("idx_loan_application_snapshots_loan_application_approval_stage").on(
        table.loanApplicationId,
        table.approvalStage
      ),
    };
  },
);
