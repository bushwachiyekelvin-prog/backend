import { relations } from "drizzle-orm";
import { users } from "./users";
import { personalDocuments } from "./personalDocuments";
import { businessProfiles } from "./businessProfiles";
import { businessDocuments } from "./businessDocuments";
import { loanProducts } from "./loanProducts";
import { loanApplications } from "./loanApplications";
import { offerLetters } from "./offerLetters";
import { investorOpportunities } from "./investorOpportunities";
import { investorOpportunityBookmarks } from "./investorOpportunityBookmarks";

export const usersRelations = relations(users, ({ many }) => ({
  personalDocuments: many(personalDocuments),
  businessProfiles: many(businessProfiles),
  loanApplications: many(loanApplications),
  investorOpportunityBookmarks: many(investorOpportunityBookmarks),
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
  loanApplications: many(loanApplications),
}));

export const businessDocumentsRelations = relations(businessDocuments, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessDocuments.businessId],
    references: [businessProfiles.id],
  }),
}));

export const investorOpportunitiesRelations = relations(
  investorOpportunities,
  ({ many }) => ({
    bookmarks: many(investorOpportunityBookmarks),
  }),
);

export const investorOpportunityBookmarksRelations = relations(
  investorOpportunityBookmarks,
  ({ one }) => ({
    user: one(users, {
      fields: [investorOpportunityBookmarks.userId],
      references: [users.id],
    }),
    opportunity: one(investorOpportunities, {
      fields: [investorOpportunityBookmarks.opportunityId],
      references: [investorOpportunities.id],
    }),
  }),
);

// Loan Products Relations
export const loanProductsRelations = relations(loanProducts, ({ many }) => ({
  loanApplications: many(loanApplications),
}));

// Loan Applications Relations
export const loanApplicationsRelations = relations(loanApplications, ({ one, many }) => ({
  user: one(users, {
    fields: [loanApplications.userId],
    references: [users.id],
  }),
  business: one(businessProfiles, {
    fields: [loanApplications.businessId],
    references: [businessProfiles.id],
  }),
  loanProduct: one(loanProducts, {
    fields: [loanApplications.loanProductId],
    references: [loanProducts.id],
  }),
  offerLetters: many(offerLetters),
}));

// Offer Letters Relations
export const offerLettersRelations = relations(offerLetters, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [offerLetters.loanApplicationId],
    references: [loanApplications.id],
  }),
}));
