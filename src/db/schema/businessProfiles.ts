import { pgTable, text, timestamp, boolean, integer, numeric, varchar, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { createId } from "@paralleldrive/cuid2";

export const businessProfiles = pgTable(
  "business_profiles",
  {
  id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
  userId: varchar("user_id", { length: 24 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  coverImage: text("cover_image"),
  entityType: varchar("entity_type", { length: 50 }),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  address: varchar("address", { length: 200 }),
  zipCode: varchar("zip_code", { length: 20 }),
  address2: varchar("address2", { length: 200 }),
  sector: varchar("sector", { length: 100 }),
  yearOfIncorporation: varchar("year_of_incorporation", { length: 10 }),
  avgMonthlyTurnover: numeric("avg_monthly_turnover", { precision: 15, scale: 2 }),
  avgYearlyTurnover: numeric("avg_yearly_turnover", { precision: 15, scale: 2 }),
  borrowingHistory: boolean("borrowing_history"),
  amountBorrowed: numeric("amount_borrowed", { precision: 15, scale: 2 }),
  loanStatus: varchar("loan_status", { length: 50 }),
  defaultReason: text("default_reason"),
  currency: varchar("currency", { length: 10 }),
  ownershipType: varchar("ownership_type", { length: 50 }),
  ownershipPercentage: integer("ownership_percentage"),
  isOwned: boolean("is_owned"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxBusinessProfilesUser: index("idx_business_profiles_user").on(table.userId),
      idxBusinessProfilesName: index("idx_business_profiles_name").on(table.name),
      idxBusinessProfilesDeletedAt: index("idx_business_profiles_deleted_at").on(table.deletedAt),
      idxBusinessProfilesCreatedAt: index("idx_business_profiles_created_at").on(table.createdAt),
      idxBusinessProfilesUserDeleted: index("idx_business_profiles_user_deleted").on(
        table.userId,
        table.deletedAt,
      ),
      idxBusinessProfilesUserCreated: index("idx_business_profiles_user_created").on(
        table.userId,
        table.createdAt,
      ),
    };
  },
);
