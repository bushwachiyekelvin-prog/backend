import { pgTable, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { investorOpportunities } from "./investorOpportunities";
export const investorOpportunityBookmarks = pgTable("investor_opportunity_bookmarks", {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    userId: varchar("user_id", { length: 24 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    opportunityId: varchar("opportunity_id", { length: 24 }).notNull().references(() => investorOpportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
    return {
        uqUserOpportunity: uniqueIndex("uq_user_opportunity_bookmark").on(table.userId, table.opportunityId),
        idxUser: index("idx_investor_opportunity_bookmarks_user").on(table.userId),
        idxOpportunity: index("idx_investor_opportunity_bookmarks_opportunity").on(table.opportunityId),
        idxCreatedAt: index("idx_investor_opportunity_bookmarks_created_at").on(table.createdAt),
    };
});
