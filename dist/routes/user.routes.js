import { clerkClient, getAuth } from "@clerk/fastify";
import { logger } from "../utils/logger";
import { verifyClerkWebhook } from "../utils/webhook.utils";
import { extractUserDataFromWebhook, extractEmailUpdateFromWebhook } from "../modules/user/user.utils";
import { sendWelcomeEmail } from "../utils/email.utils";
import { User } from "../modules/user/user.service";
import { UserModel } from "../modules/user/user.model";
export async function userRoutes(fastify) {
    // POST /user/sign-up — Clerk webhook handler
    fastify.post("/sign-up", {
        schema: {
            response: {
                200: UserModel.SignUpResponseSchema,
                400: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
        config: { rawBody: true },
    }, async (request, reply) => {
        try {
            // Prefer raw body for Svix verification
            const body = request.rawBody || request.body;
            const headers = {
                "svix-id": request.headers["svix-id"] || undefined,
                "svix-timestamp": request.headers["svix-timestamp"] || undefined,
                "svix-signature": request.headers["svix-signature"] || undefined,
            };
            const webhookResult = verifyClerkWebhook(body, headers);
            if (!webhookResult.success) {
                return reply.code(400).send({
                    error: webhookResult.error?.message || "Invalid webhook signature",
                    code: webhookResult.error?.code || "WEBHOOK_VERIFICATION_FAILED",
                });
            }
            const { event } = webhookResult;
            const { type } = event;
            if (type === "user.created") {
                const userDataResult = extractUserDataFromWebhook(event);
                if (!userDataResult.success) {
                    return reply.code(400).send({
                        error: userDataResult.error?.message ||
                            `Missing required fields: ${userDataResult.missingFields?.join(", ")}`,
                        code: userDataResult.error?.code || "INVALID_METADATA",
                    });
                }
                const userResult = await User.signUp(userDataResult.userData);
                // Send welcome email async (non-blocking)
                sendWelcomeEmail(userDataResult.userData.firstName, userDataResult.userData.email).catch((error) => {
                    logger.error("Unhandled error sending welcome email:", error);
                });
                // Send phone verification OTP if user exists
                const user = await User.findByEmail(userDataResult.userData.email);
                if (user) {
                    User.sendPhoneVerificationOtp(user.clerkId).catch((error) => {
                        logger.error("Unhandled error sending phone verification OTP:", error);
                    });
                }
                return reply.send(userResult);
            }
            else if (type === "user.updated") {
                const updateInfo = extractEmailUpdateFromWebhook(event);
                if (!updateInfo.success) {
                    return reply.code(400).send({
                        error: updateInfo.error?.message || "Invalid webhook payload",
                        code: updateInfo.error?.code || "EMAIL_UPDATE_EXTRACTION_FAILED",
                    });
                }
                const updateResult = await User.updateEmail(updateInfo.clerkId, updateInfo.email);
                return reply.send(updateResult);
            }
            return reply
                .code(400)
                .send({ error: "Invalid event type", code: "INVALID_EVENT_TYPE" });
        }
        catch (err) {
            logger.error("Unexpected error while handling sign-up:", err);
            return reply.code(400).send({
                error: "Unexpected error while handling sign-up",
                code: "UNEXPECTED_ERROR",
            });
        }
    });
    // POST /user/send-phone-otp — requires auth
    fastify.post("/send-phone-otp", {
        schema: {
            body: UserModel.OtpRequestBodySchema,
            response: {
                200: UserModel.OtpResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const result = await User.sendPhoneVerificationOtp(userId);
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error sending phone OTP:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply
                .code(500)
                .send({ error: "Failed to send OTP", code: "OTP_SEND_FAILED" });
        }
    });
    // POST /user/verify-phone-otp — requires auth
    fastify.post("/verify-phone-otp", {
        schema: {
            body: UserModel.OtpVerificationBodySchema,
            response: {
                200: UserModel.OtpVerificationResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const { otp } = request.body || {};
            if (!otp) {
                return reply
                    .code(400)
                    .send({ error: "OTP is required", code: "INVALID_INPUT" });
            }
            const result = await User.verifyPhoneOtp(userId, otp);
            // If verification succeeded, update Clerk public metadata so session claims reflect the change
            if (result.success) {
                try {
                    await clerkClient.users.updateUser(userId, {
                        publicMetadata: { isPhoneVerified: true },
                    });
                }
                catch (e) {
                    logger.error("Failed to update Clerk publicMetadata.isPhoneVerified:", e);
                    // Do not fail the request if metadata update fails; client already verified OTP
                }
            }
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error verifying phone OTP:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply.code(500).send({
                error: "Failed to verify OTP",
                code: "OTP_VERIFICATION_FAILED",
            });
        }
    });
    // GET /user/resend-phone-otp — requires auth
    fastify.get("/resend-phone-otp", {
        schema: {
            response: {
                200: UserModel.OtpResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const result = await User.resendPhoneVerificationOtp(userId);
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error resending phone OTP:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply
                .code(500)
                .send({ error: "Failed to resend OTP", code: "OTP_RESEND_FAILED" });
        }
    });
    // POST /user/edit-phone — requires auth
    fastify.post("/edit-phone", {
        schema: {
            body: UserModel.EditPhoneBodySchema,
            response: {
                200: UserModel.EditPhoneResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const { phoneNumber } = request.body || {};
            const result = await User.updatePhoneNumber(userId, phoneNumber);
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error updating phone:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply.code(500).send({
                error: "Failed to update phone",
                code: "PHONE_UPDATE_FAILED",
            });
        }
    });
    // POST /user/update-docs — update user fields and attach personal documents
    fastify.post("/update-docs", {
        schema: {
            body: UserModel.UpdateUserAndDocumentsBodySchema,
            response: {
                200: UserModel.UpdateUserAndDocumentsResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const result = await User.updateUserAndDocuments(userId, request.body);
            if (result.success) {
                try {
                    await clerkClient.users.updateUser(userId, {
                        publicMetadata: { onBoardingStage: 1, isPhoneVerified: true },
                    });
                }
                catch (e) {
                    logger.error("Failed to update Clerk publicMetadata.isPhoneVerified:", e);
                }
            }
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error updating user and documents:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply.code(500).send({
                error: "Failed to update user and documents",
                code: "UPDATE_USER_DOCS_FAILED",
            });
        }
    });
    // PUT /user/edit-profile — requires auth
    fastify.put("/edit-profile", {
        schema: {
            body: UserModel.EditUserProfileBodySchema,
            response: {
                200: UserModel.EditUserProfileResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const result = await User.editProfile(userId, request.body);
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error editing profile:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply.code(500).send({
                error: "Failed to edit profile",
                code: "PROFILE_EDIT_FAILED",
            });
        }
    });
    // GET /user — requires auth
    fastify.get("/profile", {
        schema: {
            response: {
                200: UserModel.GetUserProfileResponseSchema,
                400: UserModel.ErrorResponseSchema,
                401: UserModel.ErrorResponseSchema,
                404: UserModel.ErrorResponseSchema,
                500: UserModel.ErrorResponseSchema,
            },
            tags: ["user"],
        },
    }, async (request, reply) => {
        try {
            const { userId } = getAuth(request);
            if (!userId) {
                return reply
                    .code(401)
                    .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
            }
            const result = await User.getUserProfile(userId);
            return reply.send(result);
        }
        catch (error) {
            logger.error("Error getting user profile:", error);
            if (error?.status) {
                return reply.code(error.status).send({
                    error: error.message,
                    code: String(error.message).split("] ")[0].replace("[", ""),
                });
            }
            return reply.code(500).send({
                error: "Failed to get user profile",
                code: "GET_PROFILE_ERROR",
            });
        }
    });
}
