import { FastifyInstance } from "fastify";
import { docuSignService, DocuSignWebhookEvent } from "../services/docusign.service";
import { db } from "../db/client";
import { offerLetters } from "../db/schema/offerLetters";
import { loanApplications } from "../db/schema/loanApplications";
import { users } from "../db/schema/users";
import { applicationAuditTrail } from "../db/schema/applicationAuditTrail";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "../utils/logger";
import { AuditTrailService } from "../modules/audit-trail/audit-trail.service";
import { StatusService } from "../modules/status/status.service";

export async function webhookRoutes(fastify: FastifyInstance) {
  // DocuSign webhook endpoint
  fastify.post("/docusign", async (request, reply) => {
    try {
      const event = request.body as any; // Use any for better debugging
      
      logger.info("Received DocuSign webhook - Raw payload:", JSON.stringify(event, null, 2));
      
      // Check if the event has the expected structure
      if (!event || !event.event) {
        logger.error("Invalid webhook payload - missing event field:", event);
        reply.code(400).send({ error: "Invalid webhook payload" });
        return;
      }

      // Try to extract envelope information with fallback
      let envelopeId: string;
      let status: string;
      
      if (event.data?.envelopeSummary) {
        envelopeId = event.data.envelopeSummary.envelopeId;
        status = event.data.envelopeSummary.status;
      } else if (event.data?.envelopeId) {
        envelopeId = event.data.envelopeId;
        status = event.data.status || 'unknown';
      } else {
        logger.error("Invalid webhook payload - missing envelope information:", event);
        reply.code(400).send({ error: "Missing envelope information" });
        return;
      }
      
      logger.info("Received DocuSign webhook:", {
        event: event.event,
        envelopeId: envelopeId,
        status: status,
      });

      // Process the webhook event
      await docuSignService.processWebhookEvent(event as DocuSignWebhookEvent);

      // Update offer letter and loan application status based on DocuSign event
      await handleDocuSignStatusUpdate(event as DocuSignWebhookEvent);

      reply.code(200).send({ success: true });
    } catch (error) {
      logger.error("Error processing DocuSign webhook:", error);
      reply.code(500).send({ error: "Internal server error" });
    }
  });

  // Health check for webhooks
  fastify.get("/health", async (request, reply) => {
    reply.code(200).send({ status: "healthy", timestamp: new Date().toISOString() });
  });
}

async function handleDocuSignStatusUpdate(event: any) {
  // Extract envelope information with fallback
  let envelopeId: string;
  let status: string;
  
  if (event.data?.envelopeSummary) {
    envelopeId = event.data.envelopeSummary.envelopeId;
    status = event.data.envelopeSummary.status;
  } else if (event.data?.envelopeId) {
    envelopeId = event.data.envelopeId;
    status = event.data.status || 'unknown';
  } else {
    logger.error("Cannot extract envelope information from webhook event:", event);
    return;
  }
  
  try {
    // Find the offer letter associated with this envelope
    const offerLetter = await db.query.offerLetters.findFirst({
      where: and(
        eq(offerLetters.docuSignEnvelopeId, envelopeId),
        isNull(offerLetters.deletedAt)
      ),
      with: {
        loanApplication: true,
      },
    });

    if (!offerLetter) {
      logger.warn(`No offer letter found for DocuSign envelope ${envelopeId}`);
      return;
    }

    // Update offer letter status based on DocuSign status
    let newOfferLetterStatus = offerLetter.status;
    let newDocuSignStatus = offerLetter.docuSignStatus;
    let updateData: any = {
      updatedAt: new Date(),
    };

    switch (status) {
      case "sent":
        newDocuSignStatus = "sent";
        break;
      case "delivered":
        newDocuSignStatus = "delivered";
        break;
      case "completed":
        newOfferLetterStatus = "signed";
        newDocuSignStatus = "completed";
        updateData.signedAt = new Date();
        break;
      case "declined":
        newOfferLetterStatus = "declined";
        newDocuSignStatus = "declined";
        updateData.declinedAt = new Date();
        break;
      case "voided":
        newOfferLetterStatus = "voided";
        newDocuSignStatus = "voided";
        updateData.voidedAt = new Date();
        break;
    }

    // Update offer letter
    await db
      .update(offerLetters)
      .set({
        ...updateData,
        status: newOfferLetterStatus,
        docuSignStatus: newDocuSignStatus,
      })
      .where(eq(offerLetters.id, offerLetter.id));

    // Update loan application status if offer letter was signed or declined
    if (status === "completed" || status === "declined") {
      const newLoanStatus = status === "completed" ? "offer_letter_signed" : "offer_letter_declined";
      
      await db
        .update(loanApplications)
        .set({
          status: newLoanStatus,
          updatedAt: new Date(),
        })
        .where(eq(loanApplications.id, offerLetter.loanApplicationId));

      // Log audit trail entry
      try {
        // Get the user who created the offer letter for audit trail
        const user = offerLetter.createdBy ? await db.query.users.findFirst({
          where: eq(users.id, offerLetter.createdBy),
        }) : null;

        if (user) {
          await AuditTrailService.logAction({
            loanApplicationId: offerLetter.loanApplicationId,
            userId: user.id,
            action: status === "completed" ? "offer_letter_signed" : "offer_letter_declined",
            reason: `Offer letter ${status} via DocuSign`,
            details: `DocuSign envelope ${envelopeId} was ${status}`,
            metadata: {
              envelopeId,
              offerLetterId: offerLetter.id,
              docuSignStatus: status,
            },
          });
        }
      } catch (auditError) {
        logger.error("Failed to log audit trail for DocuSign status update:", auditError);
        // Don't fail the entire operation if audit logging fails
      }

      // Send notification about status change
      try {
        await StatusService.updateStatus({
          loanApplicationId: offerLetter.loanApplicationId,
          newStatus: newLoanStatus,
          userId: offerLetter.createdBy || "",
        });
      } catch (statusError) {
        logger.error("Failed to update status via StatusService:", statusError);
        // Don't fail the entire operation if status update fails
      }
    }

    logger.info(`Updated offer letter ${offerLetter.id} status to ${newOfferLetterStatus} based on DocuSign event ${status}`);
  } catch (error) {
    logger.error(`Error handling DocuSign status update for envelope ${envelopeId}:`, error);
    throw error;
  }
}
