import { Elysia } from "elysia";
import { UserModel } from "./user.model";
import { User } from "./user.service";
import { logger } from "../../utils/logger";
import { verifyClerkWebhook } from "../../utils/webhook.utils";
import { extractUserDataFromWebhook } from "./user.utils";
import { sendWelcomeEmail } from "../../utils/email.utils";

export const userController = new Elysia({ prefix: "/user" }).post(
  "/sign-up",
  async ({ request, status }) => {
    try {
      // Verify the webhook signature
      const body = await request.json();
      const headers = {
        "svix-id": request.headers.get("svix-id") || undefined,
        "svix-timestamp": request.headers.get("svix-timestamp") || undefined,
        "svix-signature": request.headers.get("svix-signature") || undefined,
      };

      const webhookResult = verifyClerkWebhook(body, headers);

      if (!webhookResult.success) {
        return status(400, {
          error: webhookResult.error?.message || "Invalid webhook signature",
          code: webhookResult.error?.code || "WEBHOOK_VERIFICATION_FAILED",
        });
      }

      const { event } = webhookResult;
      const { type } = event!;

      if (type === "user.created") {
        // Extract and validate user data
        const userDataResult = extractUserDataFromWebhook(event!);

        if (!userDataResult.success) {
          return status(400, {
            error:
              userDataResult.error?.message ||
              `Missing required fields: ${userDataResult.missingFields?.join(", ")}`,
            code: userDataResult.error?.code || "INVALID_METADATA",
          });
        }

        // Create user in database
        const userResult = await User.signUp(userDataResult.userData!);

        // Send welcome email (don't block the response if email fails)
        sendWelcomeEmail(
          userDataResult.userData!.firstName,
          userDataResult.userData!.email,
        ).catch((error) => {
          logger.error("Unhandled error sending welcome email:", error);
        });

        return userResult;
      } else {
        return status(400, {
          error: "Invalid event type",
          code: "INVALID_EVENT_TYPE",
        });
      }
    } catch (err) {
      logger.error("Unexpected error while handling sign-up:", err);
      return status(400, {
        error: "Unexpected error while handling sign-up",
        code: "UNEXPECTED_ERROR",
      });
    }
  },
  {
    response: {
      200: UserModel.signUpResponse,
      400: UserModel.errorResponse,
    },
  },
);
