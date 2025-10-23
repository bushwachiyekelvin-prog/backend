import { render } from '@react-email/render';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { loanApplications } from '../../db/schema/loanApplications';
import { users } from '../../db/schema/users';
import { emailService } from '../../services/email.service';
import { logger } from '../../utils/logger';
import { LoanStatusUpdateEmail } from '../../templates/email/loan-status-update';
import { DocumentRequestEmail } from '../../templates/email/document-request';
import { LoanApprovalEmail } from '../../templates/email/loan-approval';

// Notification types
export type NotificationType = 
  | 'loan_status_update'
  | 'document_request'
  | 'loan_approval'
  | 'loan_rejection'
  | 'payment_reminder'
  | 'disbursement_notification';

// Notification channels
export type NotificationChannel = 'email' | 'sms' | 'push';

// Interfaces for notification parameters
export interface NotificationParams {
  type: NotificationType;
  channel: NotificationChannel;
  recipientId: string;
  loanApplicationId?: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  scheduledAt?: Date;
}

export interface StatusUpdateNotificationData {
  previousStatus: string;
  newStatus: string;
  reason?: string;
  rejectionReason?: string;
}

export interface DocumentRequestNotificationData {
  documentType: string;
  description: string;
  dueDate?: string;
}

export interface LoanApprovalNotificationData {
  loanAmount: string;
  interestRate: string;
  termMonths: number;
  monthlyPayment: string;
  nextSteps: string[];
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: NotificationChannel;
}

function httpError(status: number, message: string) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export abstract class NotificationService {
  /**
   * Sends a notification based on type and channel
   */
  static async sendNotification(params: NotificationParams): Promise<NotificationResult> {
    try {
      const { type, channel, recipientId, loanApplicationId, data, priority = 'normal' } = params;

      // Get recipient information
      const recipient = await db.query.users.findFirst({
        where: eq(users.id, recipientId),
      });

      if (!recipient) {
        throw httpError(404, "[USER_NOT_FOUND] Recipient not found.");
      }

      // Get loan application information if provided
      let loanApplication = null;
      if (loanApplicationId) {
        const [app] = await db
          .select()
          .from(loanApplications)
          .where(
            and(
              eq(loanApplications.id, loanApplicationId),
              isNull(loanApplications.deletedAt)
            )
          )
          .limit(1);
        loanApplication = app;
      }

      // Route to appropriate notification method based on channel
      switch (channel) {
        case 'email':
          return await NotificationService.sendEmailNotification(type, recipient, loanApplication, data);
        case 'sms':
          return await NotificationService.sendSmsNotification(type, recipient, loanApplication, data);
        case 'push':
          return await NotificationService.sendPushNotification(type, recipient, loanApplication, data);
        default:
          throw httpError(400, "[INVALID_CHANNEL] Invalid notification channel.");
      }
    } catch (error: any) {
      logger.error("Error sending notification:", error);
      if (error.status) throw error;
      throw httpError(500, "[NOTIFICATION_ERROR] Failed to send notification.");
    }
  }

  /**
   * Sends email notification using React Email templates
   */
  private static async sendEmailNotification(
    type: NotificationType,
    recipient: any,
    loanApplication: any,
    data: Record<string, any>
  ): Promise<NotificationResult> {
    try {
      let emailHtml: string;
      let subject: string;

      // Prepare common email data
      const emailData = {
        firstName: recipient.firstName || 'Valued Customer',
        email: recipient.email,
        loginUrl: process.env.APP_URL || '#',
        supportEmail: process.env.SUPPORT_EMAIL || 'support@melaninkapital.com',
        supportPhone: process.env.SUPPORT_PHONE || '+254703680991',
        termsUrl: process.env.TERMS_URL || 'https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLsw0JXtTaSljhRqXr6mBuJN1opUPFeKbcZg3k',
        privacyUrl: process.env.PRIVACY_URL || 'https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLvFVCntHCgvpe94FiSQ72Z3oc8WVDqNGKtasB',
        unsubscribeUrl: process.env.UNSUBSCRIBE_URL || '#',
      };

      // Generate email content based on type
      switch (type) {
        case 'loan_status_update': {
          const statusData = data as StatusUpdateNotificationData;
          emailHtml = await render(
            LoanStatusUpdateEmail({
              ...emailData,
              loanApplicationId: loanApplication?.id || 'N/A',
              previousStatus: statusData.previousStatus,
              newStatus: statusData.newStatus,
              reason: statusData.reason,
              rejectionReason: statusData.rejectionReason,
            })
          );
          subject = `Loan Application Status Update - ${statusData.newStatus}`;
          break;
        }

        case 'document_request': {
          const docData = data as DocumentRequestNotificationData;
          emailHtml = await render(
            DocumentRequestEmail({
              ...emailData,
              loanApplicationId: loanApplication?.id || 'N/A',
              documentType: docData.documentType,
              description: docData.description,
              dueDate: docData.dueDate,
            })
          );
          subject = `Document Request - ${docData.documentType}`;
          break;
        }

        case 'loan_approval': {
          const approvalData = data as LoanApprovalNotificationData;
          emailHtml = await render(
            LoanApprovalEmail({
              ...emailData,
              loanApplicationId: loanApplication?.id || 'N/A',
              loanAmount: approvalData.loanAmount,
              interestRate: approvalData.interestRate,
              termMonths: approvalData.termMonths,
              monthlyPayment: approvalData.monthlyPayment,
              nextSteps: approvalData.nextSteps,
            })
          );
          subject = '🎉 Congratulations! Your Loan is Approved';
          break;
        }

        default:
          throw httpError(400, "[UNSUPPORTED_TYPE] Unsupported notification type for email.");
      }

      // Send email using existing email service
      const result = await emailService.sendEmail({
        to: recipient.email,
        subject,
        html: emailHtml,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        channel: 'email',
      };
    } catch (error: any) {
      logger.error("Error sending email notification:", error);
      return {
        success: false,
        error: error.message,
        channel: 'email',
      };
    }
  }

  /**
   * Sends SMS notification
   */
  private static async sendSmsNotification(
    type: NotificationType,
    recipient: any,
    loanApplication: any,
    data: Record<string, any>
  ): Promise<NotificationResult> {
    try {
      // TODO: Implement SMS notification logic
      // This would integrate with your SMS service
      logger.info("SMS notification not yet implemented", { type, recipientId: recipient.id });
      
      return {
        success: true,
        messageId: 'sms-placeholder',
        channel: 'sms',
      };
    } catch (error: any) {
      logger.error("Error sending SMS notification:", error);
      return {
        success: false,
        error: error.message,
        channel: 'sms',
      };
    }
  }

  /**
   * Sends push notification
   */
  private static async sendPushNotification(
    type: NotificationType,
    recipient: any,
    loanApplication: any,
    data: Record<string, any>
  ): Promise<NotificationResult> {
    try {
      // TODO: Implement push notification logic
      // This would integrate with your push notification service
      logger.info("Push notification not yet implemented", { type, recipientId: recipient.id });
      
      return {
        success: true,
        messageId: 'push-placeholder',
        channel: 'push',
      };
    } catch (error: any) {
      logger.error("Error sending push notification:", error);
      return {
        success: false,
        error: error.message,
        channel: 'push',
      };
    }
  }

  /**
   * Sends loan status update notification
   */
  static async sendStatusUpdateNotification(
    loanApplicationId: string,
    userId: string,
    statusData: StatusUpdateNotificationData,
    channels: NotificationChannel[] = ['email']
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      try {
        const result = await NotificationService.sendNotification({
          type: 'loan_status_update',
          channel,
          recipientId: userId,
          loanApplicationId,
          data: statusData,
          priority: 'normal',
        });
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          channel,
        });
      }
    }

    return results;
  }

  /**
   * Sends document request notification
   */
  static async sendDocumentRequestNotification(
    loanApplicationId: string,
    userId: string,
    docData: DocumentRequestNotificationData,
    channels: NotificationChannel[] = ['email']
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      try {
        const result = await NotificationService.sendNotification({
          type: 'document_request',
          channel,
          recipientId: userId,
          loanApplicationId,
          data: docData,
          priority: 'high',
        });
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          channel,
        });
      }
    }

    return results;
  }

  /**
   * Sends loan approval notification
   */
  static async sendLoanApprovalNotification(
    loanApplicationId: string,
    userId: string,
    approvalData: LoanApprovalNotificationData,
    channels: NotificationChannel[] = ['email']
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      try {
        const result = await NotificationService.sendNotification({
          type: 'loan_approval',
          channel,
          recipientId: userId,
          loanApplicationId,
          data: approvalData,
          priority: 'high',
        });
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message,
          channel,
        });
      }
    }

    return results;
  }
}
