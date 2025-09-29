import { and, eq, isNull, desc, count, lt, gte } from "drizzle-orm";
import { db } from "../../db";
import { offerLetters } from "../../db/schema/offerLetters";
import { loanApplications } from "../../db/schema/loanApplications";
import { users } from "../../db/schema/users";
import { OfferLettersModel } from "./offer-letters.model";
import { 
  mapOfferLetterRow, 
  generateOfferNumber,
  toNumber 
} from "./offer-letters.mapper";
import { logger } from "../../utils/logger";

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}


export abstract class OfferLettersService {
  /**
   * Create a new offer letter
   */
  static async create(
    clerkId: string,
    body: OfferLettersModel.CreateOfferLetterBody,
  ): Promise<OfferLettersModel.CreateOfferLetterResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      // Get user by clerkId
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      // Validate loan application exists and is approved
      const loanApplication = await db.query.loanApplications.findFirst({
        where: and(eq(loanApplications.id, body.loanApplicationId), isNull(loanApplications.deletedAt)),
      });
      if (!loanApplication) throw httpError(404, "[LOAN_APPLICATION_NOT_FOUND] Loan application not found");

      if (loanApplication.status !== "approved") {
        throw httpError(400, "[INVALID_STATUS] Only approved loan applications can have offer letters");
      }

      // Check if there's already an active offer letter for this application
      const existingActiveOffer = await db.query.offerLetters.findFirst({
        where: and(
          eq(offerLetters.loanApplicationId, body.loanApplicationId),
          eq(offerLetters.isActive, true),
          isNull(offerLetters.deletedAt)
        ),
      });

      if (existingActiveOffer) {
        throw httpError(400, "[ACTIVE_OFFER_EXISTS] An active offer letter already exists for this application");
      }

      // Get the latest version number for this application
      const latestOffer = await db.query.offerLetters.findFirst({
        where: and(
          eq(offerLetters.loanApplicationId, body.loanApplicationId),
          isNull(offerLetters.deletedAt)
        ),
        orderBy: [desc(offerLetters.version)],
      });

      const version = latestOffer ? latestOffer.version + 1 : 1;
      const offerNumber = generateOfferNumber();

      const values = {
        loanApplicationId: body.loanApplicationId,
        offerNumber,
        version,
        offerAmount: body.offerAmount as any,
        offerTerm: body.offerTerm,
        interestRate: body.interestRate as any,
        currency: body.currency,
        specialConditions: body.specialConditions ?? null,
        requiresGuarantor: body.requiresGuarantor ?? false,
        requiresCollateral: body.requiresCollateral ?? false,
        docuSignEnvelopeId: null,
        docuSignStatus: "not_sent" as any,
        docuSignTemplateId: body.docuSignTemplateId ?? null,
        offerLetterUrl: null,
        signedDocumentUrl: null,
        recipientEmail: body.recipientEmail,
        recipientName: body.recipientName,
        expiresAt: new Date(body.expiresAt),
        status: "draft" as any,
        isActive: true,
        createdBy: user.id,
        notes: body.notes ?? null,
      };

      const [row] = await db
        .insert(offerLetters)
        .values(values)
        .returning();

      const offerLetter = mapOfferLetterRow(row);

      return {
        success: true,
        message: "Offer letter created successfully",
        data: offerLetter,
      };
    } catch (error: any) {
      logger.error("Error creating offer letter:", error);
      if (error?.status) throw error;
      throw httpError(500, "[CREATE_OFFER_LETTER_ERROR] Failed to create offer letter");
    }
  }

  /**
   * Send offer letter via DocuSign
   */
  static async sendOfferLetter(
    clerkId: string,
    id: string,
    body: OfferLettersModel.SendOfferLetterBody,
  ): Promise<OfferLettersModel.SendOfferLetterResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(offerLetters)
        .where(and(eq(offerLetters.id, id), isNull(offerLetters.deletedAt)))
        .limit(1);

      if (!existing) throw httpError(404, "[OFFER_LETTER_NOT_FOUND] Offer letter not found");

      if (existing.status !== "draft") {
        throw httpError(400, "[INVALID_STATUS] Only draft offer letters can be sent");
      }

      // TODO: Integrate with DocuSign API
      // For now, simulate the DocuSign integration
      const envelopeId = `envelope_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const offerLetterUrl = `https://demo.docusign.net/signing/documents/${envelopeId}`;

      await db
        .update(offerLetters)
        .set({
          docuSignEnvelopeId: envelopeId,
          docuSignTemplateId: body.docuSignTemplateId,
          docuSignStatus: "sent",
          offerLetterUrl,
          recipientEmail: body.recipientEmail,
          recipientName: body.recipientName,
          status: "sent",
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(offerLetters.id, id));

      return {
        success: true,
        message: "Offer letter sent successfully",
        data: {
          envelopeId,
          offerLetterUrl,
        },
      };
    } catch (error: any) {
      logger.error("Error sending offer letter:", error);
      if (error?.status) throw error;
      throw httpError(500, "[SEND_OFFER_LETTER_ERROR] Failed to send offer letter");
    }
  }

  /**
   * List offer letters with optional filtering and pagination
   */
  static async list(
    clerkId: string,
    query: OfferLettersModel.ListOfferLettersQuery = {},
  ): Promise<OfferLettersModel.ListOfferLettersResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const page = query.page ?? 1;
      const limit = query.limit ?? 20;
      const offset = (page - 1) * limit;

      // Build where conditions
      const whereConditions = [isNull(offerLetters.deletedAt)];

      if (query.status) {
        whereConditions.push(eq(offerLetters.status, query.status));
      }
      if (query.docuSignStatus) {
        whereConditions.push(eq(offerLetters.docuSignStatus, query.docuSignStatus));
      }
      if (query.loanApplicationId) {
        whereConditions.push(eq(offerLetters.loanApplicationId, query.loanApplicationId));
      }
      if (query.isActive !== undefined) {
        whereConditions.push(eq(offerLetters.isActive, query.isActive));
      }
      if (query.expiresBefore) {
        whereConditions.push(lt(offerLetters.expiresAt, new Date(query.expiresBefore)));
      }

      // Get total count
      const [{ total }] = await db
        .select({ total: count() })
        .from(offerLetters)
        .where(and(...whereConditions));

      // Get offer letters with related data
      const rows = await db
        .select({
          offerLetter: offerLetters,
          loanApplication: {
            id: loanApplications.id,
            applicationNumber: loanApplications.applicationNumber,
            loanAmount: loanApplications.loanAmount,
            loanTerm: loanApplications.loanTerm,
            currency: loanApplications.currency,
            purpose: loanApplications.purpose,
            status: loanApplications.status,
          },
        })
        .from(offerLetters)
        .leftJoin(loanApplications, eq(offerLetters.loanApplicationId, loanApplications.id))
        .where(and(...whereConditions))
        .orderBy(desc(offerLetters.createdAt))
        .limit(limit)
        .offset(offset);

      const offerLettersList = rows.map(row => 
        mapOfferLetterRow(row.offerLetter, {
          loanApplication: row.loanApplication,
        })
      );

      return {
        success: true,
        message: "Offer letters retrieved successfully",
        data: offerLettersList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: any) {
      logger.error("Error listing offer letters:", error);
      if (error?.status) throw error;
      throw httpError(500, "[LIST_OFFER_LETTERS_ERROR] Failed to list offer letters");
    }
  }

  /**
   * Get a single offer letter by ID
   */
  static async getById(
    clerkId: string,
    id: string,
  ): Promise<OfferLettersModel.GetOfferLetterResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [row] = await db
        .select({
          offerLetter: offerLetters,
          loanApplication: {
            id: loanApplications.id,
            applicationNumber: loanApplications.applicationNumber,
            loanAmount: loanApplications.loanAmount,
            loanTerm: loanApplications.loanTerm,
            currency: loanApplications.currency,
            purpose: loanApplications.purpose,
            status: loanApplications.status,
          },
        })
        .from(offerLetters)
        .leftJoin(loanApplications, eq(offerLetters.loanApplicationId, loanApplications.id))
        .where(and(eq(offerLetters.id, id), isNull(offerLetters.deletedAt)))
        .limit(1);

      if (!row) throw httpError(404, "[OFFER_LETTER_NOT_FOUND] Offer letter not found");

      const offerLetter = mapOfferLetterRow(row.offerLetter, {
        loanApplication: row.loanApplication,
      });

      return {
        success: true,
        message: "Offer letter retrieved successfully",
        data: offerLetter,
      };
    } catch (error: any) {
      logger.error("Error getting offer letter:", error);
      if (error?.status) throw error;
      throw httpError(500, "[GET_OFFER_LETTER_ERROR] Failed to get offer letter");
    }
  }

  /**
   * Update an offer letter (only draft offer letters can be updated)
   */
  static async update(
    clerkId: string,
    id: string,
    body: OfferLettersModel.UpdateOfferLetterBody,
  ): Promise<OfferLettersModel.UpdateOfferLetterResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(offerLetters)
        .where(and(eq(offerLetters.id, id), isNull(offerLetters.deletedAt)))
        .limit(1);

      if (!existing) throw httpError(404, "[OFFER_LETTER_NOT_FOUND] Offer letter not found");

      if (existing.status !== "draft") {
        throw httpError(400, "[INVALID_STATUS] Only draft offer letters can be updated");
      }

      const updateSet: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (body.offerAmount !== undefined) updateSet.offerAmount = body.offerAmount;
      if (body.offerTerm !== undefined) updateSet.offerTerm = body.offerTerm;
      if (body.interestRate !== undefined) updateSet.interestRate = body.interestRate;
      if (body.specialConditions !== undefined) updateSet.specialConditions = body.specialConditions;
      if (body.requiresGuarantor !== undefined) updateSet.requiresGuarantor = body.requiresGuarantor;
      if (body.requiresCollateral !== undefined) updateSet.requiresCollateral = body.requiresCollateral;
      if (body.recipientEmail !== undefined) updateSet.recipientEmail = body.recipientEmail;
      if (body.recipientName !== undefined) updateSet.recipientName = body.recipientName;
      if (body.expiresAt !== undefined) updateSet.expiresAt = new Date(body.expiresAt);
      if (body.notes !== undefined) updateSet.notes = body.notes;

      const [row] = await db
        .update(offerLetters)
        .set(updateSet)
        .where(eq(offerLetters.id, id))
        .returning();

      const offerLetter = mapOfferLetterRow(row);

      return {
        success: true,
        message: "Offer letter updated successfully",
        data: offerLetter,
      };
    } catch (error: any) {
      logger.error("Error updating offer letter:", error);
      if (error?.status) throw error;
      throw httpError(500, "[UPDATE_OFFER_LETTER_ERROR] Failed to update offer letter");
    }
  }

  /**
   * Handle DocuSign webhook events
   */
  static async handleDocuSignWebhook(
    body: OfferLettersModel.DocuSignWebhookBody,
  ): Promise<OfferLettersModel.BasicSuccessResponse> {
    try {
      const [existing] = await db
        .select()
        .from(offerLetters)
        .where(and(
          eq(offerLetters.docuSignEnvelopeId, body.envelopeId),
          isNull(offerLetters.deletedAt)
        ))
        .limit(1);

      if (!existing) {
        logger.warn(`DocuSign webhook received for unknown envelope: ${body.envelopeId}`);
        return {
          success: true,
          message: "Webhook processed (envelope not found)",
        };
      }

      const updateSet: Record<string, any> = {
        docuSignStatus: body.status,
        updatedAt: new Date(),
      };

      // Set appropriate timestamp based on status
      const statusChangedAt = new Date(body.statusChangedDateTime);
      switch (body.status) {
        case "delivered":
          updateSet.deliveredAt = statusChangedAt;
          updateSet.status = "delivered";
          break;
        case "viewed":
          updateSet.viewedAt = statusChangedAt;
          updateSet.status = "viewed";
          break;
        case "completed":
          updateSet.signedAt = statusChangedAt;
          updateSet.status = "signed";
          // Update loan application status to offer_letter_signed
          await db
            .update(loanApplications)
            .set({
              status: "offer_letter_signed",
              updatedAt: new Date(),
            })
            .where(eq(loanApplications.id, existing.loanApplicationId));
          break;
        case "declined":
          updateSet.declinedAt = statusChangedAt;
          updateSet.status = "declined";
          break;
        case "voided":
          updateSet.status = "voided";
          break;
        case "expired":
          updateSet.expiredAt = statusChangedAt;
          updateSet.status = "expired";
          break;
      }

      await db
        .update(offerLetters)
        .set(updateSet)
        .where(eq(offerLetters.id, existing.id));

      return {
        success: true,
        message: "DocuSign webhook processed successfully",
      };
    } catch (error: any) {
      logger.error("Error processing DocuSign webhook:", error);
      throw httpError(500, "[DOCUSIGN_WEBHOOK_ERROR] Failed to process DocuSign webhook");
    }
  }

  /**
   * Void an offer letter
   */
  static async voidOfferLetter(
    clerkId: string,
    id: string,
  ): Promise<OfferLettersModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(offerLetters)
        .where(and(eq(offerLetters.id, id), isNull(offerLetters.deletedAt)))
        .limit(1);

      if (!existing) throw httpError(404, "[OFFER_LETTER_NOT_FOUND] Offer letter not found");

      if (["signed", "declined", "voided", "expired"].includes(existing.status)) {
        throw httpError(400, "[INVALID_STATUS] Offer letter cannot be voided in current status");
      }

      await db
        .update(offerLetters)
        .set({
          status: "voided",
          docuSignStatus: "voided",
          updatedAt: new Date(),
        })
        .where(eq(offerLetters.id, id));

      return {
        success: true,
        message: "Offer letter voided successfully",
      };
    } catch (error: any) {
      logger.error("Error voiding offer letter:", error);
      if (error?.status) throw error;
      throw httpError(500, "[VOID_OFFER_LETTER_ERROR] Failed to void offer letter");
    }
  }

  /**
   * Soft delete an offer letter
   */
  static async remove(
    clerkId: string,
    id: string,
  ): Promise<OfferLettersModel.BasicSuccessResponse> {
    try {
      if (!clerkId) throw httpError(401, "[UNAUTHORIZED] Missing user context");

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });
      if (!user) throw httpError(404, "[USER_NOT_FOUND] User not found");

      const [existing] = await db
        .select()
        .from(offerLetters)
        .where(and(eq(offerLetters.id, id), isNull(offerLetters.deletedAt)))
        .limit(1);

      if (!existing) throw httpError(404, "[OFFER_LETTER_NOT_FOUND] Offer letter not found");

      // Only allow deletion of draft offer letters
      if (existing.status !== "draft") {
        throw httpError(400, "[INVALID_STATUS] Only draft offer letters can be deleted");
      }

      await db
        .update(offerLetters)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(offerLetters.id, id));

      return {
        success: true,
        message: "Offer letter deleted successfully",
      };
    } catch (error: any) {
      logger.error("Error deleting offer letter:", error);
      if (error?.status) throw error;
      throw httpError(500, "[DELETE_OFFER_LETTER_ERROR] Failed to delete offer letter");
    }
  }

  /**
   * Get expiring offer letters (for reminder system)
   */
  static async getExpiringOfferLetters(
    hoursUntilExpiry: number = 24,
  ): Promise<OfferLettersModel.OfferLetterItem[]> {
    try {
      const expiryThreshold = new Date();
      expiryThreshold.setHours(expiryThreshold.getHours() + hoursUntilExpiry);

      const rows = await db
        .select({
          offerLetter: offerLetters,
          loanApplication: {
            id: loanApplications.id,
            applicationNumber: loanApplications.applicationNumber,
            loanAmount: loanApplications.loanAmount,
            loanTerm: loanApplications.loanTerm,
            currency: loanApplications.currency,
            purpose: loanApplications.purpose,
            status: loanApplications.status,
          },
        })
        .from(offerLetters)
        .leftJoin(loanApplications, eq(offerLetters.loanApplicationId, loanApplications.id))
        .where(and(
          eq(offerLetters.isActive, true),
          eq(offerLetters.status, "sent"),
          gte(offerLetters.expiresAt, new Date()),
          lt(offerLetters.expiresAt, expiryThreshold),
          isNull(offerLetters.deletedAt)
        ));

      return rows.map(row => 
        mapOfferLetterRow(row.offerLetter, {
          loanApplication: row.loanApplication,
        })
      );
    } catch (error: any) {
      logger.error("Error getting expiring offer letters:", error);
      throw httpError(500, "[GET_EXPIRING_OFFER_LETTERS_ERROR] Failed to get expiring offer letters");
    }
  }
}
