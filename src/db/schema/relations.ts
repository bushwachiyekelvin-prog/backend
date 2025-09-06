import { relations } from "drizzle-orm";
import { users } from "./users";
import { personalDocuments } from "./personalDocuments";
import { businessProfiles } from "./businessProfiles";
import { businessDocuments } from "./businessDocuments";

export const usersRelations = relations(users, ({ many }) => ({
  personalDocuments: many(personalDocuments),
  businessProfiles: many(businessProfiles),
}));

export const personalDocumentsRelations = relations(personalDocuments, ({ one }) => ({
  user: one(users, {
    fields: [personalDocuments.userId],
    references: [users.id],
  }),
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one, many }) => ({
  owner: one(users, {
    fields: [businessProfiles.userId],
    references: [users.id],
  }),
  documents: many(businessDocuments),
}));

export const businessDocumentsRelations = relations(businessDocuments, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessDocuments.businessId],
    references: [businessProfiles.id],
  }),
}));
