import { z } from "zod";

// Notification type validation
export const NotificationTypeSchema = z.enum([
  "loan_status_update",
  "document_request", 
  "loan_approval",
  "loan_rejection",
  "payment_reminder",
  "disbursement_notification"
]);

export const NotificationChannelSchema = z.enum([
  "email",
  "sms", 
  "push"
]);

export const NotificationPrioritySchema = z.enum([
  "low",
  "normal",
  "high"
]);

// Request schemas
export const NotificationParamsSchema = z.object({
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  recipientId: z.string(),
  loanApplicationId: z.string().optional(),
  data: z.record(z.string(), z.any()),
  priority: NotificationPrioritySchema.optional(),
  scheduledAt: z.date().optional(),
});

export const StatusUpdateNotificationDataSchema = z.object({
  previousStatus: z.string(),
  newStatus: z.string(),
  reason: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const DocumentRequestNotificationDataSchema = z.object({
  documentType: z.string(),
  description: z.string(),
  dueDate: z.string().optional(),
});

export const LoanApprovalNotificationDataSchema = z.object({
  loanAmount: z.string(),
  interestRate: z.string(),
  termMonths: z.number(),
  monthlyPayment: z.string(),
  nextSteps: z.array(z.string()),
});

export const NotificationResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  error: z.string().optional(),
  channel: NotificationChannelSchema,
});

// Response schemas
export const NotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(NotificationResultSchema),
});

export const BulkNotificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    totalSent: z.number(),
    successful: z.number(),
    failed: z.number(),
    results: z.array(NotificationResultSchema),
  }),
});

// Type exports
export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type NotificationPriority = z.infer<typeof NotificationPrioritySchema>;
export type NotificationParams = z.infer<typeof NotificationParamsSchema>;
export type StatusUpdateNotificationData = z.infer<typeof StatusUpdateNotificationDataSchema>;
export type DocumentRequestNotificationData = z.infer<typeof DocumentRequestNotificationDataSchema>;
export type LoanApprovalNotificationData = z.infer<typeof LoanApprovalNotificationDataSchema>;
export type NotificationResult = z.infer<typeof NotificationResultSchema>;
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
export type BulkNotificationResponse = z.infer<typeof BulkNotificationResponseSchema>;
