import { z } from "zod";

// Status enum validation
export const LoanApplicationStatusSchema = z.enum([
  "draft",
  "submitted", 
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
  "disbursed"
]);

export type LoanApplicationStatus = z.infer<typeof LoanApplicationStatusSchema>;

// Request schemas
export const UpdateStatusBodySchema = z.object({
  status: LoanApplicationStatusSchema,
  reason: z.string().optional(),
  rejectionReason: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const StatusResponseSchema = z.object({
  status: LoanApplicationStatusSchema,
  statusReason: z.string().nullable(),
  lastUpdatedBy: z.string().nullable(),
  lastUpdatedAt: z.date().nullable(),
  allowedTransitions: z.array(LoanApplicationStatusSchema),
});

export const StatusUpdateResponseSchema = z.object({
  success: z.boolean(),
  previousStatus: LoanApplicationStatusSchema,
  newStatus: LoanApplicationStatusSchema,
  message: z.string(),
  snapshotCreated: z.boolean().optional(),
  auditEntryId: z.string().optional(),
});

export const StatusHistoryItemSchema = z.object({
  status: z.string(),
  reason: z.string().nullable(),
  details: z.string().nullable(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  createdAt: z.date(),
  metadata: z.record(z.string(), z.any()).nullable(),
});

export const StatusHistoryResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(StatusHistoryItemSchema),
});

// Type exports
export type UpdateStatusBody = z.infer<typeof UpdateStatusBodySchema>;
export type StatusResponse = z.infer<typeof StatusResponseSchema>;
export type StatusUpdateResponse = z.infer<typeof StatusUpdateResponseSchema>;
export type StatusHistoryItem = z.infer<typeof StatusHistoryItemSchema>;
export type StatusHistoryResponse = z.infer<typeof StatusHistoryResponseSchema>;
