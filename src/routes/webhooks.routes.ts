import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { docuSignService, type DocuSignWebhookEvent } from "../services/docusign.service";
import { db } from "../db";
import { users, internalInvitations } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "../utils/logger";
import { verifyClerkWebhook } from "../utils/webhook.utils";
import { extractEmailUpdateFromWebhook, extractUserDataFromWebhook } from "../modules/user/user.utils";
import { sendWelcomeEmail } from "../utils/email.utils";
import { User } from "../modules/user/user.service";
import { emailService } from "../services/email.service";
import { UserDeletionService } from "../services/user-deletion.service";
import { DocuSignWebhookService } from "../services/docusign-webhook.service";

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
      await DocuSignWebhookService.handleStatusUpdate(event as DocuSignWebhookEvent);

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

          // Determine internal invite + role from public metadata
          const publicMeta: any = (event as any)?.data?.public_metadata || (event as any)?.data?.publicMeta;
          const isInternal: boolean = publicMeta?.internal === true;
          const invitedRole: string | undefined = publicMeta?.role;

          // If role present, mirror into local users table
          try {
            const u = await User.findByEmail(userDataResult.userData!.email);
            if (u && invitedRole) {
              await db.update(users).set({ role: invitedRole, updatedAt: new Date() }).where(eq(users.id, u.id));
            }
          } catch {}
          // Send welcome email async (non-blocking)
          sendWelcomeEmail(
            userDataResult.userData!.firstName,
            userDataResult.userData!.email,
          ).catch((error) => {
            logger.error("Unhandled error sending welcome email:", error);
          });

          // For internal users, skip phone OTP; otherwise send if user exists
          if (!isInternal) {
            const user = await User.findByEmail(userDataResult.userData!.email);
            if (user) {
              User.sendPhoneVerificationOtp(user.clerkId).catch((error) => {
                logger.error("Unhandled error sending phone verification OTP:", error);
              });
            }
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
            const toEmail: string | undefined = payload?.to_email_address;

            // Branch A: Verification code emails (existing behavior)
            const code: string | undefined = payload?.data?.otp_code;
            if (code && toEmail) {
              let firstName = "";
              try {
                const user = await User.findByEmail(toEmail);
                if (!user) {
                  logger.warn("User not found by email for firstName; proceeding without it", { toEmail });
                } else if (user.firstName) {
                  firstName = user.firstName;
                }
              } catch (e) {
                logger.warn("Lookup errored; proceeding without firstName", { toEmail, error: e instanceof Error ? e.message : e });
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
            }

            // Branch B: Invitation emails — send our custom invite email with __clerk_ticket link
            // Attempt to extract the invitation CTA URL Clerk includes (name may vary by template)
            const inviteUrl: string | undefined = payload?.data?.action_url || payload?.data?.url || payload?.data?.links?.[0]?.url;
            if (toEmail && inviteUrl) {
              // Find latest pending internal invitation to get the intended role
              const record = await db.query.internalInvitations.findFirst({
                where: eq(internalInvitations.email, toEmail),
                orderBy: desc(internalInvitations.createdAt),
              });

              const role: 'super-admin' | 'admin' | 'member' = (record?.role as any) || 'member';
              const sendInvite = await emailService.sendInternalInviteEmail({ email: toEmail, inviteUrl, role });
              if (!sendInvite.success) {
                logger.error("Failed to send custom internal invite email", { toEmail, error: sendInvite.error });
                return reply.code(500).send({ error: "INVITE_EMAIL_SEND_FAILED" });
              }

              return reply.send({ received: true, messageId: sendInvite.messageId });
            }

            // If neither OTP nor invitation URL present, ignore
            logger.warn("email.created payload not recognized (no otp_code or invite url)", { hasEmail: !!toEmail });
            return reply.code(200).send({ received: true, ignored: true });
          } catch (e) {
            logger.error("Unexpected error handling email.created", e);
            return reply.code(500).send({ error: "INTERNAL_ERROR" });
          }
        }

        if (type === "user.deleted") {
          try {
            const clerkId: string | undefined = event?.data?.id;

            if (!clerkId) {
              logger.warn("user.deleted event missing clerk user ID");
              return reply.code(200).send({ received: true, ignored: true });
            }

            logger.info("Processing user.deleted event", { clerkId });
            await UserDeletionService.deleteUserAndAllRelatedData(clerkId);
            return reply.send({ received: true, deleted: true });
          } catch (e) {
            logger.error("Unexpected error handling user.deleted", e);
            return reply.code(500).send({ error: "USER_DELETION_FAILED" });
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
