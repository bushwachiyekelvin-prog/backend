import { UserModel } from "./user.model";
import { db } from "../../db";
import { users } from "../../db/schema/users";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import { OtpUtils } from "../../utils/otp.utils";
import { smsService } from "../../services/sms.service";
import { clerkClient } from "@clerk/fastify";

// Lightweight HTTP error helper compatible with our route error handling
function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class User {
  static async signUp(
    userPayload: UserModel.SignUpBody,
  ): Promise<UserModel.SignUpResponse> {
    try {
      // Ensure dob is a Date object for the DB layer
      const values = {
        ...userPayload,
        dob:
          typeof userPayload.dob === "string"
            ? new Date(userPayload.dob)
            : userPayload.dob,
      } as any;
      const user = await db.insert(users).values(values).returning();
      return {
        email: user[0].email,
      };
    } catch (error: any) {
      logger.error(error);
      throw httpError(500, "[SIGNUP_ERROR] An error occurred while signing up");
    }
  }

  /**
   * Find a user by email
   * @param email User's email
   * @returns User object or null if not found
   */
  static async findByEmail(email: string) {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      return user;
    } catch (error) {
      logger.error("Error finding user by email:", error);
      return null;
    }
  }

  /**
   * Generate and send OTP to user's phone number
   * @param clerkId User's Clerk ID
   * @returns Success status
   */
  static async sendPhoneVerificationOtp(
    clerkId: string,
  ): Promise<UserModel.OtpResponse> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        return {
          success: true,
          message: "Phone number already verified",
          isAlreadyVerified: true,
        };
      }

      if (!user.phoneNumber) {
        throw httpError(400, "[INVALID_PHONE] No phone number found for user");
      }

      // Generate OTP
      const otp = OtpUtils.generateOtp();
      const expiryTime = OtpUtils.calculateExpiryTime();

      // Update user with OTP and expiry
      await db
        .update(users)
        .set({
          phoneVerificationCode: otp,
          phoneVerificationExpiry: expiryTime,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // Send OTP via SMS
      await smsService.sendOtp(user.phoneNumber, otp);

      return {
        success: true,
        message: "OTP sent successfully",
        isAlreadyVerified: false,
      };
    } catch (error: any) {
      logger.error("Error sending OTP:", error);
      if (error.status) throw error;
      throw httpError(500, "[OTP_ERROR] Failed to send OTP");
    }
  }

  /**
   * Verify OTP sent to user's phone
   * @param clerkId User's Clerk ID
   * @param otp OTP code entered by user
   * @returns Success status
   */
  static async verifyPhoneOtp(
    clerkId: string,
    otp: string,
  ): Promise<UserModel.OtpVerificationResponse> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        return {
          success: true,
          message: "Phone number already verified",
        };
      }

      // Validate OTP
      const isValid = OtpUtils.validateOtp(
        otp,
        user.phoneVerificationCode || null,
        user.phoneVerificationExpiry || null,
      );

      if (!isValid) {
        return {
          success: false,
          message: "Invalid or expired OTP",
        };
      }

      // Update user as verified
      await db
        .update(users)
        .set({
          isPhoneVerified: true,
          phoneVerificationCode: null,
          phoneVerificationExpiry: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      return {
        success: true,
        message: "Phone number verified successfully",
      };
    } catch (error: any) {
      logger.error("Error verifying OTP:", error);
      if (error.status) throw error;
      throw httpError(500, "[VERIFICATION_ERROR] Failed to verify OTP");
    }
  }

  /**
   * Resend OTP to user's phone
   * @param clerkId User's Clerk ID
   * @returns Success status
   */
  static async resendPhoneVerificationOtp(
    clerkId: string,
  ): Promise<UserModel.OtpResponse> {
    return this.sendPhoneVerificationOtp(clerkId);
  }

  /**
   * Update a non verified user's phone number
   * @param clerkId User's Clerk ID
   * @param phoneNumber User's phone number
   * */
  static async updatePhoneNumber(
    clerkId: string,
    phoneNumber: string,
  ): Promise<UserModel.EditPhoneResponse> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw httpError(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        throw httpError(400, "[PHONE_VERIFIED] Phone number already verified");
      }

      if (!user.phoneNumber) {
        throw httpError(400, "[INVALID_PHONE] No phone number found for user");
      }

      await db
        .update(users)
        .set({
          phoneNumber,
        })
        .where(eq(users.id, user.id));

      // update clerk unsafe metadata phone number
      await clerkClient.users.updateUserMetadata(user.clerkId, {
        unsafeMetadata: {
          phoneNumber,
        },
      });


      return {
        success: true,
        message: "Phone number updated successfully",
      };
    } catch (error: any) {
      logger.error("Error updating phone number:", error);
      if (error.status) throw error;
      throw httpError(
        500,
        "[UPDATE_PHONE_ERROR] Failed to update phone number",
      );
    }
  }
}
