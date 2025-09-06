import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 24 }).$defaultFn(() => createId()).primaryKey(),
    clerkId: varchar("clerk_id", { length: 64 }).notNull().unique(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    imageUrl: text("image_url"),
    email: varchar("email", { length: 320 }).notNull().unique(),
    phoneNumber: varchar("phone_number", { length: 32 }),
    role: varchar("role", { length: 50 }),
    position: varchar("position", { length: 50 }),
    gender: varchar("gender", { length: 20 }),
    idNumber: varchar("id_number", { length: 50 }),
    taxNumber: varchar("tax_number", { length: 50 }),
    dob: timestamp("dob", { withTimezone: true }),
    idType: varchar("id_type", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => {
    return {
      idxUsersDeletedAt: index("idx_users_deleted_at").on(table.deletedAt),
      idxUsersCreatedAt: index("idx_users_created_at").on(table.createdAt),
    };
  },
);
