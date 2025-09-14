import { Elysia, t } from "elysia";
import { UserModel } from "./user.model";
import { User } from "./user.service";
import { logger } from "../../utils/logger";
import { verifyClerkWebhook } from "../../utils/webhook.utils";
import { extractUserDataFromWebhook } from "./user.utils";
import { sendWelcomeEmail } from "../../utils/email.utils";
import { clerkPlugin } from "elysia-clerk";

export const userController = new Elysia({ prefix: "/user" })
  .use(clerkPlugin())
  .post(
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

          // Get the user ID from the database
          const user = await User.findByEmail(userDataResult.userData!.email);

          if (user) {
            // Send phone verification OTP (don't block the response if SMS fails)
            User.sendPhoneVerificationOtp(user.clerkId).catch((error) => {
              logger.error(
                "Unhandled error sending phone verification OTP:",
                error,
              );
            });
          }

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
  )
  .post(
    "/send-phone-otp",
    async ({ status, auth: getAuth }) => {
      try {
        const userId = getAuth().userId;

        if (!userId) {
          return status(401, {
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const result = await User.sendPhoneVerificationOtp(userId);
        return result;
      } catch (error: any) {
        logger.error("Error sending phone OTP:", error);
        if (error.status) {
          return status(error.status, {
            error: error.message,
            code: error.message.split("] ")[0].replace("[", ""),
          });
        }
        return status(500, {
          error: "Failed to send OTP",
          code: "OTP_SEND_FAILED",
        });
      }
    },
    {
      body: UserModel.otpRequestBody,
      response: {
        200: UserModel.otpResponse,
        400: UserModel.errorResponse,
        401: UserModel.errorResponse,
        404: UserModel.errorResponse,
        500: UserModel.errorResponse,
      },
    },
  )
  .post(
    "/verify-phone-otp",
    async ({ body, status, auth }) => {
      logger.info("I have been summoned");
      const {otp} = body;
      try {
        const userId = auth().userId;

        if (!userId) {
          return status(401, {
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        if (!otp) {
          return status(400, {
            error: "OTP is required",
            code: "INVALID_INPUT",
          });
        }

        const result = await User.verifyPhoneOtp(userId, otp);
        return result;
      } catch (error: any) {
        logger.error("Error verifying phone OTP:", error);
        if (error.status) {
          return status(error.status, {
            error: error.message,
            code: error.message.split("] ")[0].replace("[", ""),
          });
        }
        return status(500, {
          error: "Failed to verify OTP",
          code: "OTP_VERIFICATION_FAILED",
        });
      }
    },
    {
      body: UserModel.otpVerificationBody,
      response: {
        200: UserModel.otpVerificationResponse,
        400: UserModel.errorResponse,
        401: UserModel.errorResponse,
        404: UserModel.errorResponse,
        500: UserModel.errorResponse,
      },
    },
  )
  .get(
    "/resend-phone-otp",
    async ({ auth, status }) => {
      try {
        const userId = auth().userId;

        if (!userId) {
          return status(401, {
            error: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }

        const result = await User.resendPhoneVerificationOtp(userId);
        return result;
      } catch (error: any) {
        logger.error("Error resending phone OTP:", error);
        if (error.status) {
          return status(error.status, {
            error: error.message,
            code: error.message.split("] ")[0].replace("[", ""),
          });
        }
        return status(500, {
          error: "Failed to resend OTP",
          code: "OTP_RESEND_FAILED",
        });
      }
    },
    {
      response: {
        200: UserModel.otpResponse,
        400: UserModel.errorResponse,
        401: UserModel.errorResponse,
        404: UserModel.errorResponse,
        500: UserModel.errorResponse,
      },
    },
  );
