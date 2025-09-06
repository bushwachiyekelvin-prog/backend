import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { businessProfiles } from "./businessProfiles";
import { createId } from "@paralleldrive/cuid2";

export const businessDocuments = pgTable(
  "business_documents",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    businessId: varchar("business_id", { length: 24 }).notNull().references(() => businessProfiles.id, { onDelete: "cascade" }),
    docType: varchar("doc_type", { length: 50 }),
    docUrl: text("doc_url"),
    docPassword: varchar("doc_password", { length: 200 }),
    docBankName: varchar("doc_bank_name", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxBusinessDocsBusiness: index("idx_business_docs_business").on(table.businessId),
      idxBusinessDocsType: index("idx_business_docs_type").on(table.docType),
      idxBusinessDocsDeletedAt: index("idx_business_docs_deleted_at").on(table.deletedAt),
      idxBusinessDocsCreatedAt: index("idx_business_docs_created_at").on(table.createdAt),
      idxBusinessDocsBusinessDeleted: index("idx_business_docs_business_deleted").on(
        table.businessId,
        table.deletedAt,
      ),
      idxBusinessDocsBusinessCreated: index("idx_business_docs_business_created").on(
        table.businessId,
        table.createdAt,
      ),
    };
  },
);
