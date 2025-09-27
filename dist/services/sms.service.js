import AfricasTalking from 'africastalking';
import { logger } from '../utils/logger';
/**
 * SMS Service for handling all SMS operations using Africa's Talking API
 */
export class SmsService {
    constructor() {
        const username = process.env.AT_USERNAME || '';
        const apiKey = process.env.AT_API_KEY || '';
        if (!username || !apiKey) {
            logger.warn('Africa\'s Talking credentials not found. SMS service will not work properly.');
        }
        // Initialize the SDK
        const africastalking = AfricasTalking({
            apiKey,
            username,
        });
        // Get the SMS service
        this.sms = africastalking.SMS;
    }
    /**
     * Get the singleton instance of SmsService
     */
    static getInstance() {
        if (!SmsService.instance) {
            SmsService.instance = new SmsService();
        }
        return SmsService.instance;
    }
    /**
     * Send an OTP message to a phone number
     * @param phoneNumber The recipient's phone number (should include country code)
     * @param otp The OTP code to send
     * @returns Promise with the result of the SMS sending operation
     */
    async sendOtp(phoneNumber, otp) {
        try {
            const options = {
                to: [phoneNumber],
                message: `Your verification code is: ${otp}. Valid for 10 minutes. Do not share this code with anyone.`,
                // Use 'MKAP' as the sender ID (optional, depends on your Africa's Talking configuration)
                from: process.env.AT_SENDER_ID,
            };
            const response = await this.sms.send(options);
            logger.info(`SMS sent to ${phoneNumber}`, { response });
            return response;
        }
        catch (error) {
            logger.error(`Failed to send SMS to ${phoneNumber}`, { error });
            throw error;
        }
    }
}
// Export a singleton instance
export const smsService = SmsService.getInstance();
