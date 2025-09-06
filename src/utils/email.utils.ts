import { emailService } from "../services/email.service";
import { logger } from "./logger";

export interface SendWelcomeEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a welcome email to a new user
 * @param firstName User's first name
 * @param email User's email address
 * @returns SendWelcomeEmailResult with success status and message ID or error
 */
export const sendWelcomeEmail = async (
  firstName: string,
  email: string
): Promise<SendWelcomeEmailResult> => {
  try {
    const emailResult = await emailService.sendWelcomeEmail({
      firstName,
      email,
    });

    if (!emailResult.success) {
      logger.warn(`Failed to send welcome email to ${email}:`, emailResult.error);
    } else {
      logger.info(`Welcome email sent successfully to ${email}`);
    }

    return emailResult;
  } catch (error) {
    logger.error(`Error sending welcome email to ${email}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error sending welcome email",
    };
  }
};
