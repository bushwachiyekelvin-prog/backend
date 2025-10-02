import { db } from "../../db/client";
import { loanApplicationSnapshots } from "../../db/schema/loanApplicationSnapshots";
import { loanApplications } from "../../db/schema/loanApplications";
import { businessDocuments } from "../../db/schema/businessDocuments";
import { personalDocuments } from "../../db/schema/personalDocuments";
import { businessProfiles } from "../../db/schema/businessProfiles";
import { offerLetters } from "../../db/schema/offerLetters";
import { eq, desc } from "drizzle-orm";

function httpError(status: number, message: string) {
  const error = new Error(message) as any;
  error.statusCode = status;
  return error;
}

export interface CreateSnapshotParams {
  loanApplicationId: string;
  createdBy: string;
  approvalStage?: string;
  existingApplication?: any; // Optional pre-fetched application data
}

export interface SnapshotData {
  application: any;
  businessProfile?: any;
  personalDocuments: any[];
  businessDocuments: any[];
  offerLetters: any[];
  metadata: {
    createdAt: string;
    createdBy: string;
    approvalStage: string;
  };
}

export interface SnapshotEntry {
  id: string;
  loanApplicationId: string;
  createdBy: string;
  snapshotData: SnapshotData;
  approvalStage: string;
  createdAt: string;
}

export abstract class SnapshotService {
  /**
   * Create a snapshot of a loan application at approval time
   * 
   * @param params - Snapshot creation parameters
   * @returns Created snapshot entry
   * 
   * @throws {400} If required parameters are missing
   * @throws {404} If loan application not found
   * @throws {500} If snapshot creation fails
   */
  static async createSnapshot(params: CreateSnapshotParams): Promise<SnapshotEntry> {
    try {
      // Validate required parameters
      if (!params.loanApplicationId || !params.createdBy) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId and createdBy are required");
      }

      // Use existing application data or fetch it
      let application = params.existingApplication;
      if (!application) {
        const [fetchedApplication] = await db
          .select()
          .from(loanApplications)
          .where(eq(loanApplications.id, params.loanApplicationId))
          .limit(1);
        
        if (!fetchedApplication) {
          throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");
        }
        application = fetchedApplication;
      }

      // Run all related data queries in parallel for better performance
      const [businessProfile, personalDocs, businessDocs, offerLetterDocs] = await Promise.all([
        // Get business profile if it exists
        application.businessId 
          ? db.select().from(businessProfiles).where(eq(businessProfiles.id, application.businessId)).limit(1).then(results => results[0] || null)
          : Promise.resolve(null),
        
        // Get personal documents
        db.select().from(personalDocuments).where(eq(personalDocuments.userId, application.userId)),
        
        // Get business documents if business exists
        application.businessId 
          ? db.select().from(businessDocuments).where(eq(businessDocuments.businessId, application.businessId))
          : Promise.resolve([]),
        
        // Get offer letters for this loan application
        db.select().from(offerLetters).where(eq(offerLetters.loanApplicationId, params.loanApplicationId))
      ]);

      // Prepare snapshot data
      const snapshotData: SnapshotData = {
        application: {
          id: application.id,
          applicationNumber: application.applicationNumber,
          userId: application.userId,
          businessId: application.businessId,
          loanProductId: application.loanProductId,
          coApplicantIds: application.coApplicantIds,
          loanAmount: application.loanAmount,
          loanTerm: application.loanTerm,
          currency: application.currency,
          purpose: application.purpose,
          purposeDescription: application.purposeDescription,
          status: application.status,
          isBusinessLoan: application.isBusinessLoan,
          submittedAt: application.submittedAt?.toISOString() || null,
          reviewedAt: application.reviewedAt?.toISOString() || null,
          approvedAt: application.approvedAt?.toISOString() || null,
          disbursedAt: application.disbursedAt?.toISOString() || null,
          rejectedAt: application.rejectedAt?.toISOString() || null,
          rejectionReason: application.rejectionReason,
          statusReason: application.statusReason,
          lastUpdatedBy: application.lastUpdatedBy,
          lastUpdatedAt: application.lastUpdatedAt?.toISOString() || null,
          createdAt: application.createdAt.toISOString(),
          updatedAt: application.updatedAt.toISOString(),
        },
        businessProfile: businessProfile ? {
          id: businessProfile.id,
          userId: businessProfile.userId,
          name: businessProfile.name,
          description: businessProfile.description,
          imageUrl: businessProfile.imageUrl,
          coverImage: businessProfile.coverImage,
          entityType: businessProfile.entityType,
          country: businessProfile.country,
          city: businessProfile.city,
          address: businessProfile.address,
          zipCode: businessProfile.zipCode,
          address2: businessProfile.address2,
          sector: businessProfile.sector,
          yearOfIncorporation: businessProfile.yearOfIncorporation,
          avgMonthlyTurnover: businessProfile.avgMonthlyTurnover,
          avgYearlyTurnover: businessProfile.avgYearlyTurnover,
          borrowingHistory: businessProfile.borrowingHistory,
          amountBorrowed: businessProfile.amountBorrowed,
          loanStatus: businessProfile.loanStatus,
          defaultReason: businessProfile.defaultReason,
          currency: businessProfile.currency,
          ownershipType: businessProfile.ownershipType,
          ownershipPercentage: businessProfile.ownershipPercentage,
          isOwned: businessProfile.isOwned,
          createdAt: businessProfile.createdAt.toISOString(),
          updatedAt: businessProfile.updatedAt.toISOString(),
        } : null,
        personalDocuments: personalDocs.map(doc => ({
          id: doc.id,
          userId: doc.userId,
          docType: doc.docType,
          docUrl: doc.docUrl,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        })),
        businessDocuments: businessDocs.map(doc => ({
          id: doc.id,
          businessId: doc.businessId,
          docType: doc.docType,
          docUrl: doc.docUrl,
          isPasswordProtected: doc.isPasswordProtected,
          docPassword: doc.docPassword,
          docBankName: doc.docBankName,
          docYear: doc.docYear,
          createdAt: doc.createdAt.toISOString(),
          updatedAt: doc.updatedAt.toISOString(),
        })),
        offerLetters: offerLetterDocs.map(letter => ({
          id: letter.id,
          loanApplicationId: letter.loanApplicationId,
          createdBy: letter.createdBy,
          offerNumber: letter.offerNumber,
          version: letter.version,
          recipientEmail: letter.recipientEmail,
          recipientName: letter.recipientName,
          offerAmount: letter.offerAmount,
          offerTerm: letter.offerTerm,
          interestRate: letter.interestRate,
          currency: letter.currency,
          specialConditions: letter.specialConditions,
          requiresGuarantor: letter.requiresGuarantor,
          requiresCollateral: letter.requiresCollateral,
          status: letter.status,
          docuSignEnvelopeId: letter.docuSignEnvelopeId,
          docuSignStatus: letter.docuSignStatus,
          docuSignTemplateId: letter.docuSignTemplateId,
          offerLetterUrl: letter.offerLetterUrl,
          signedDocumentUrl: letter.signedDocumentUrl,
          sentAt: letter.sentAt?.toISOString() || null,
          signedAt: letter.signedAt?.toISOString() || null,
          declinedAt: letter.declinedAt?.toISOString() || null,
          expiredAt: letter.expiredAt?.toISOString() || null,
          createdAt: letter.createdAt.toISOString(),
          updatedAt: letter.updatedAt.toISOString(),
        })),
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: params.createdBy,
          approvalStage: params.approvalStage || "loan_approval",
        },
      };

      // Insert snapshot
      const [result] = await db
        .insert(loanApplicationSnapshots)
        .values({
          loanApplicationId: params.loanApplicationId,
          createdBy: params.createdBy,
          snapshotData: JSON.stringify(snapshotData),
          approvalStage: params.approvalStage || "loan_approval",
        })
        .returning();

      if (!result) {
        throw httpError(500, "[SNAPSHOT_CREATION_FAILED] Failed to create snapshot");
      }

      // Return formatted result
      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        createdBy: result.createdBy,
        snapshotData,
        approvalStage: result.approvalStage,
        createdAt: result.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[SNAPSHOT_ERROR] ${error.message}`);
    }
  }

  /**
   * Get snapshot by ID
   * 
   * @param snapshotId - Snapshot ID
   * @returns Snapshot entry
   * 
   * @throws {400} If snapshotId is missing
   * @throws {404} If snapshot not found
   * @throws {500} If query fails
   */
  static async getSnapshot(snapshotId: string): Promise<SnapshotEntry> {
    try {
      if (!snapshotId) {
        throw httpError(400, "[INVALID_PARAMETERS] snapshotId is required");
      }

      const [result] = await db
        .select()
        .from(loanApplicationSnapshots)
        .where(eq(loanApplicationSnapshots.id, snapshotId))
        .limit(1);

      if (!result) {
        throw httpError(404, "[SNAPSHOT_NOT_FOUND] Snapshot not found");
      }

      // Parse snapshot data
      const snapshotData = JSON.parse(result.snapshotData);

      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        createdBy: result.createdBy,
        snapshotData,
        approvalStage: result.approvalStage,
        createdAt: result.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[SNAPSHOT_ERROR] ${error.message}`);
    }
  }

  /**
   * Get snapshots for a loan application
   * 
   * @param loanApplicationId - Loan application ID
   * @returns Array of snapshot entries
   * 
   * @throws {400} If loanApplicationId is missing
   * @throws {500} If query fails
   */
  static async getSnapshots(loanApplicationId: string): Promise<SnapshotEntry[]> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId is required");
      }

      const results = await db
        .select()
        .from(loanApplicationSnapshots)
        .where(eq(loanApplicationSnapshots.loanApplicationId, loanApplicationId))
        .orderBy(desc(loanApplicationSnapshots.createdAt));

      // Parse snapshot data for each result
      return results.map(result => {
        const snapshotData = JSON.parse(result.snapshotData);
        return {
          id: result.id,
          loanApplicationId: result.loanApplicationId,
          createdBy: result.createdBy,
          snapshotData,
          approvalStage: result.approvalStage,
          createdAt: result.createdAt.toISOString(),
        };
      });
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[SNAPSHOT_ERROR] ${error.message}`);
    }
  }

  /**
   * Get the latest snapshot for a loan application
   * 
   * @param loanApplicationId - Loan application ID
   * @returns Latest snapshot entry or null
   * 
   * @throws {400} If loanApplicationId is missing
   * @throws {500} If query fails
   */
  static async getLatestSnapshot(loanApplicationId: string): Promise<SnapshotEntry | null> {
    try {
      if (!loanApplicationId) {
        throw httpError(400, "[INVALID_PARAMETERS] loanApplicationId is required");
      }

      const [result] = await db
        .select()
        .from(loanApplicationSnapshots)
        .where(eq(loanApplicationSnapshots.loanApplicationId, loanApplicationId))
        .orderBy(desc(loanApplicationSnapshots.createdAt))
        .limit(1);

      if (!result) {
        return null;
      }

      // Parse snapshot data
      const snapshotData = JSON.parse(result.snapshotData);

      return {
        id: result.id,
        loanApplicationId: result.loanApplicationId,
        createdBy: result.createdBy,
        snapshotData,
        approvalStage: result.approvalStage,
        createdAt: result.createdAt.toISOString(),
      };
    } catch (error: any) {
      if (error.statusCode) {
        throw error;
      }
      throw httpError(500, `[SNAPSHOT_ERROR] ${error.message}`);
    }
  }
}
