import { UserModel } from "./user.model";
import { db } from "../../db";
import { users } from "../../db/schema/users";
import { status } from "elysia";
import { logger } from "../../utils/logger";
import { eq } from "drizzle-orm";
import { OtpUtils } from "../../utils/otp.utils";
import { smsService } from "../../services/sms.service";

export abstract class User {
  static async signUp(
    userPayload: UserModel.signUpBody,
  ): Promise<UserModel.signUpResponse> {
    try {
      const user = await db.insert(users).values(userPayload).returning();
      return {
        email: user[0].email,
      };
    } catch (error: any) {
      logger.error(error);
      throw status(500, "[SIGNUP_ERROR] An error occurred while signing up");
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
    clerkId: string
  ): Promise<UserModel.otpResponse> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw status(404, "[USER_NOT_FOUND] User not found");
      }

      if (user.isPhoneVerified) {
        return {
          success: true,
          message: "Phone number already verified",
          isAlreadyVerified: true,
        };
      }

      if (!user.phoneNumber) {
        throw status(400, "[INVALID_PHONE] No phone number found for user");
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
      throw status(500, "[OTP_ERROR] Failed to send OTP");
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
    otp: string
  ): Promise<UserModel.otpVerificationResponse> {
    try {
      // Get user details
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        throw status(404, "[USER_NOT_FOUND] User not found");
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
        user.phoneVerificationExpiry || null
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
      throw status(500, "[VERIFICATION_ERROR] Failed to verify OTP");
    }
  }

  /**
   * Resend OTP to user's phone
   * @param clerkId User's Clerk ID
   * @returns Success status
   */
  static async resendPhoneVerificationOtp(
    clerkId: string
  ): Promise<UserModel.otpResponse> {
    return this.sendPhoneVerificationOtp(clerkId);
  }
}
