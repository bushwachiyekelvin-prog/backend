import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { docuSignService, DocuSignWebhookEvent } from "../services/docusign.service";
import { db } from "../db/client";
import { offerLetters } from "../db/schema/offerLetters";
import { loanApplications } from "../db/schema/loanApplications";
import { users } from "../db/schema/users";
import { applicationAuditTrail } from "../db/schema/applicationAuditTrail";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "../utils/logger";
import { AuditTrailService } from "../modules/audit-trail/audit-trail.service";
import { verifyClerkWebhook } from "../utils/webhook.utils";
import { extractEmailUpdateFromWebhook, extractUserDataFromWebhook } from "../modules/user/user.utils";
import { sendWelcomeEmail } from "../utils/email.utils";
import { User } from "../modules/user/user.service";
import { emailService } from "../services/email.service";

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

  // Clerk webhook endpoint
  fastify.post(
    "/clerk",
    { config: { rawBody: true } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body: any = (request as any).rawBody || request.body;
        const headers = {
          "svix-id": (request.headers["svix-id"] as string) || undefined,
          "svix-timestamp": (request.headers["svix-timestamp"] as string) || undefined,
          "svix-signature": (request.headers["svix-signature"] as string) || undefined,
        } as const;

        const webhookResult = verifyClerkWebhook(body, headers);
        if (!webhookResult.success) {
          return reply.code(400).send({
            error: webhookResult.error?.message || "Invalid webhook signature",
            code: webhookResult.error?.code || "WEBHOOK_VERIFICATION_FAILED",
          });
        }

        const { event } = webhookResult;
        const { type } = event!;

        if (type === "user.created") {
          const userDataResult = extractUserDataFromWebhook(event!);
          if (!userDataResult.success) {
            return reply.code(400).send({
              error:
                userDataResult.error?.message ||
                `Missing required fields: ${userDataResult.missingFields?.join(", ")}`,
              code: userDataResult.error?.code || "INVALID_METADATA",
            });
          }

          const userResult = await User.signUp(userDataResult.userData!);

          // Send welcome email async (non-blocking)
          sendWelcomeEmail(
            userDataResult.userData!.firstName,
            userDataResult.userData!.email,
          ).catch((error) => {
            logger.error("Unhandled error sending welcome email:", error);
          });

          // Send phone verification OTP if user exists
          const user = await User.findByEmail(userDataResult.userData!.email);
          if (user) {
            User.sendPhoneVerificationOtp(user.clerkId).catch((error) => {
              logger.error("Unhandled error sending phone verification OTP:", error);
            });
          }

          return reply.send(userResult);
        }

        if (type === "user.updated") {
          const updateInfo = extractEmailUpdateFromWebhook(event!);
          if (!updateInfo.success) {
            return reply.code(400).send({
              error: updateInfo.error?.message || "Invalid webhook payload",
              code: updateInfo.error?.code || "EMAIL_UPDATE_EXTRACTION_FAILED",
            });
          }

          const updateResult = await User.updateEmail(
            updateInfo.clerkId!,
            updateInfo.email!,
          );
          return reply.send(updateResult);
        }

        if (type === "email.created") {
          try {
            const payload: any = event?.data || {};
            const code: string | undefined = payload?.data?.otp_code;
            const toEmail: string | undefined = payload?.to_email_address;

            if (!code || !toEmail) {
              logger.warn("email.created missing otp_code or to_email_address", { codePresent: !!code, toEmailPresent: !!toEmail });
              return reply.code(200).send({ received: true, ignored: true });
            }

            let firstName = "";
            try {
              const user = await User.findByEmail(toEmail);
              if (user?.firstName) firstName = user.firstName;
            } catch (e) {
              logger.warn("Could not fetch user by email for firstName; proceeding without it", { toEmail });
            }

            const sendResult = await emailService.sendVerificationCodeEmail({
              firstName,
              email: toEmail,
              code,
            });

            if (!sendResult.success) {
              logger.error("Failed to dispatch verification email", { toEmail, error: sendResult.error });
              return reply.code(500).send({ error: "EMAIL_SEND_FAILED" });
            }

            return reply.send({ received: true, messageId: sendResult.messageId });
          } catch (e) {
            logger.error("Unexpected error handling email.created", e);
            return reply.code(500).send({ error: "INTERNAL_ERROR" });
          }
        }

        return reply
          .code(200)
          .send({ received: true, ignored: true, type });
      } catch (err) {
        logger.error("Unexpected error while handling Clerk webhook:", err);
        return reply.code(400).send({
          error: "Unexpected error while handling Clerk webhook",
          code: "UNEXPECTED_ERROR",
        });
      }
    },
  );

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
    // Map webhook event to status
    switch (event.event) {
      case 'envelope-sent':
        status = 'sent';
        break;
      case 'envelope-delivered':
        status = 'delivered';
        break;
      case 'envelope-completed':
        status = 'completed';
        break;
      case 'envelope-declined':
        status = 'declined';
        break;
      case 'envelope-voided':
        status = 'voided';
        break;
      default:
        status = event.data.status || 'unknown';
    }
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
    logger.info(`Updating offer letter ${offerLetter.id}: status ${offerLetter.status} -> ${newOfferLetterStatus}, docuSignStatus ${offerLetter.docuSignStatus} -> ${newDocuSignStatus}`);
    
    await db
      .update(offerLetters)
      .set({
        ...updateData,
        status: newOfferLetterStatus,
        docuSignStatus: newDocuSignStatus,
      })
      .where(eq(offerLetters.id, offerLetter.id));

    // Log audit trail entry for all status changes
    try {
      logger.info(`Creating audit trail for offer letter ${offerLetter.id} with status ${status}, createdBy: ${offerLetter.createdBy}`);
      
      // Get the user who created the offer letter for audit trail
      const user = offerLetter.createdBy ? await db.query.users.findFirst({
        where: eq(users.id, offerLetter.createdBy),
      }) : null;

      if (user) {
        logger.info(`Found user ${user.id} for audit trail, creating entry`);
        
        // Map status to audit action
        let auditAction: string;
        let reason: string;
        
        switch (status) {
          case "sent":
            auditAction = "offer_letter_sent";
            reason = "Offer letter sent via DocuSign";
            break;
          case "delivered":
            auditAction = "offer_letter_delivered";
            reason = "Offer letter delivered to recipient";
            break;
          case "completed":
            auditAction = "offer_letter_signed";
            reason = "Offer letter signed via DocuSign";
            break;
          case "declined":
            auditAction = "offer_letter_declined";
            reason = "Offer letter declined via DocuSign";
            break;
          default:
            auditAction = "offer_letter_updated";
            reason = `Offer letter status updated to ${status}`;
        }
        
        await AuditTrailService.logAction({
          loanApplicationId: offerLetter.loanApplicationId,
          userId: user.id,
          action: auditAction,
          reason,
          details: `DocuSign envelope ${envelopeId} was ${status}. Offer letter ${offerLetter.offerNumber} status updated.`,
          metadata: {
            envelopeId,
            offerLetterId: offerLetter.id,
            offerNumber: offerLetter.offerNumber,
            docuSignStatus: status,
            webhookEvent: event.event,
          },
        });
        
        logger.info(`Successfully created audit trail entry for ${auditAction}`);
      } else {
        logger.warn(`No user found for offer letter ${offerLetter.id}, createdBy: ${offerLetter.createdBy}`);
      }
    } catch (auditError) {
      logger.error("Failed to log audit trail for DocuSign status update:", auditError);
      // Don't fail the entire operation if audit logging fails
    }

    // Update loan application status if offer letter was signed or declined
    if (status === "completed" || status === "declined") {
      const newLoanStatus = status === "completed" ? "offer_letter_signed" : "offer_letter_declined";

      // Update loan application status directly (without triggering automation)
      if (newLoanStatus) {
        try {
          logger.info(`Updating loan application ${offerLetter.loanApplicationId} status to ${newLoanStatus} via webhook`);
          
          // Get the user's Clerk ID for the foreign key constraint
          const creator = await db.query.users.findFirst({
            where: eq(users.id, offerLetter.createdBy),
            columns: { clerkId: true }
          });
          
          await db
            .update(loanApplications)
            .set({
              status: newLoanStatus,
              statusReason: `Status updated via DocuSign webhook: ${status}`,
              lastUpdatedBy: creator?.clerkId || "system",
              lastUpdatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(loanApplications.id, offerLetter.loanApplicationId));
          
          logger.info(`Successfully updated loan application ${offerLetter.loanApplicationId} status to ${newLoanStatus} via webhook`);
        } catch (statusError) {
          logger.error("Failed to update loan application status via webhook:", statusError);
          // Don't fail the entire operation if status update fails
        }
      }
    }

    logger.info(`Updated offer letter ${offerLetter.id} status to ${newOfferLetterStatus} based on DocuSign event ${status}`);
  } catch (error) {
    logger.error(`Error handling DocuSign status update for envelope ${envelopeId}:`, error);
    throw error;
  }
}
