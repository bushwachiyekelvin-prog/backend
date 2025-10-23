import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { config } from "dotenv";
import { render } from '@react-email/render';
import VerificationCodeTemplate from '../templates/email/verification-code-template';

config({
  path: ".env.local"
})

export interface WelcomeEmailData {
  firstName: string;
  email: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface VerificationEmailData {
  firstName?: string;
  email: string;
  code: string;
}

export class EmailService {
  private resend: Resend;
  private welcomeTemplate: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    
    this.resend = new Resend(apiKey);
    
    // Load welcome email template
    try {
      const templatePath = join(process.cwd(), 'src', 'templates', 'welcome-email.html');
      this.welcomeTemplate = readFileSync(templatePath, 'utf-8');
    } catch (error) {
      logger.error('Failed to load welcome email template:', error);
      throw new Error('Failed to load welcome email template');
    }
  }

  private replaceTemplateVariables(template: string, data: WelcomeEmailData): string {
    const replacements = {
      '{{firstName}}': data.firstName,
      '{{loginUrl}}': data.loginUrl || process.env.APP_URL || '#',
      '{{supportEmail}}': data.supportEmail || process.env.SUPPORT_EMAIL || 'support@melaninkapital.com',
      '{{supportPhone}}': data.supportPhone || process.env.SUPPORT_PHONE || '+254703680991',
      '{{termsUrl}}': data.termsUrl || process.env.TERMS_URL || 'https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLsw0JXtTaSljhRqXr6mBuJN1opUPFeKbcZg3k',
      '{{privacyUrl}}': data.privacyUrl || process.env.PRIVACY_URL || 'https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLvFVCntHCgvpe94FiSQ72Z3oc8WVDqNGKtasB',
      '{{unsubscribeUrl}}': data.unsubscribeUrl || process.env.UNSUBSCRIBE_URL || '#'
    };

    let processedTemplate = template;
    Object.entries(replacements).forEach(([placeholder, value]) => {
      processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
    });

    return processedTemplate;
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const htmlContent = this.replaceTemplateVariables(this.welcomeTemplate, data);
      
      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.email],
        subject: 'Welcome to Melanin Kapital - Your Journey Begins Now! 🚀',
        html: htmlContent,
      });

      if (result.error) {
        logger.error('Failed to send welcome email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Welcome email sent successfully to ${data.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.resend.emails.send({
        from: data.from || process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.to],
        subject: data.subject,
        html: data.html,
      });

      if (result.error) {
        logger.error('Failed to send email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Email sent successfully to ${data.to}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendVerificationCodeEmail(data: VerificationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        VerificationCodeTemplate({ firstName: data.firstName || '', code: data.code })
      );

      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.email],
        subject: `Your verification code is ${data.code}`,
        html,
      });

      if (result.error) {
        logger.error('Failed to send verification code email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Verification email sent successfully to ${data.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending verification code email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
