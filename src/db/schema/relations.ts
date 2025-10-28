import { relations } from "drizzle-orm";
import { users } from "./users";
import { personalDocuments } from "./personalDocuments";
import { businessProfiles } from "./businessProfiles";
import { businessDocuments } from "./businessDocuments";
import { loanProducts } from "./loanProducts";
import { loanProductSnapshots } from "./loanProductSnapshots";
import { loanApplications } from "./loanApplications";
import { applicationAuditTrail } from "./applicationAuditTrail";
import { loanApplicationSnapshots } from "./loanApplicationSnapshots";
import { documentRequests } from "./documentRequests";
import { offerLetters } from "./offerLetters";
import { investorOpportunities } from "./investorOpportunities";
import { investorOpportunityBookmarks } from "./investorOpportunityBookmarks";
import { userGroups } from "./userGroups";
import { userGroupMembers } from "./userGroupMembers";

export const usersRelations = relations(users, ({ many }) => ({
  personalDocuments: many(personalDocuments),
  businessProfiles: many(businessProfiles),
  loanApplications: many(loanApplications),
  auditTrailEntries: many(applicationAuditTrail),
  createdSnapshots: many(loanApplicationSnapshots),
  requestedDocuments: many(documentRequests, { relationName: "requestedBy" }),
  documentRequests: many(documentRequests, { relationName: "requestedFrom" }),
  investorOpportunityBookmarks: many(investorOpportunityBookmarks),
  groupMemberships: many(userGroupMembers),
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

export const userGroupsRelations = relations(userGroups, ({ many }) => ({
  memberships: many(userGroupMembers),
}));

export const userGroupMembersRelations = relations(userGroupMembers, ({ one }) => ({
  user: one(users, {
    fields: [userGroupMembers.userId],
    references: [users.id],
  }),
  group: one(userGroups, {
    fields: [userGroupMembers.groupId],
    references: [userGroups.id],
  }),
}));

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
  productSnapshots: many(loanProductSnapshots),
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
  productSnapshot: one(loanProductSnapshots, {
    fields: [loanApplications.id],
    references: [loanProductSnapshots.loanApplicationId],
  }),
  lastUpdatedByUser: one(users, {
    fields: [loanApplications.lastUpdatedBy],
    references: [users.clerkId],
  }),
  auditTrail: many(applicationAuditTrail),
  snapshots: many(loanApplicationSnapshots),
  documentRequests: many(documentRequests),
  offerLetters: many(offerLetters),
}));

// Offer Letters Relations
export const offerLettersRelations = relations(offerLetters, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [offerLetters.loanApplicationId],
    references: [loanApplications.id],
  }),
}));

// Loan Product Snapshots Relations
export const loanProductSnapshotsRelations = relations(loanProductSnapshots, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [loanProductSnapshots.loanApplicationId],
    references: [loanApplications.id],
  }),
  loanProduct: one(loanProducts, {
    fields: [loanProductSnapshots.loanProductId],
    references: [loanProducts.id],
  }),
}));

// Application Audit Trail Relations
export const applicationAuditTrailRelations = relations(applicationAuditTrail, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [applicationAuditTrail.loanApplicationId],
    references: [loanApplications.id],
  }),
  user: one(users, {
    fields: [applicationAuditTrail.userId],
    references: [users.id],
  }),
}));

// Loan Application Snapshots Relations
export const loanApplicationSnapshotsRelations = relations(loanApplicationSnapshots, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [loanApplicationSnapshots.loanApplicationId],
    references: [loanApplications.id],
  }),
  createdBy: one(users, {
    fields: [loanApplicationSnapshots.createdBy],
    references: [users.id],
  }),
}));

// Document Requests Relations
export const documentRequestsRelations = relations(documentRequests, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [documentRequests.loanApplicationId],
    references: [loanApplications.id],
  }),
  requestedBy: one(users, {
    fields: [documentRequests.requestedBy],
    references: [users.id],
    relationName: "requestedBy",
  }),
  requestedFrom: one(users, {
    fields: [documentRequests.requestedFrom],
    references: [users.id],
    relationName: "requestedFrom",
  }),
}));
