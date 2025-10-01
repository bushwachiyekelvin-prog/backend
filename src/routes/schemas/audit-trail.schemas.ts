import { UserModel } from "../../modules/user/user.model";

export const AuditTrailResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          loanApplicationId: { type: "string" },
          userId: { type: "string" },
          action: { type: "string" },
          reason: { type: "string", nullable: true },
          details: { type: "string", nullable: true },
          metadata: { type: "object", nullable: true },
          beforeData: { type: "object", nullable: true },
          afterData: { type: "object", nullable: true },
          createdAt: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              email: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const AuditTrailSummaryResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        totalEntries: { type: "number" },
        actionsCount: { type: "object" },
        usersCount: { type: "object" },
        firstEntryAt: { type: "string", nullable: true },
        lastEntryAt: { type: "string", nullable: true },
      },
    },
  },
};

export const AuditTrailQuerySchema = {
  type: "object",
  properties: {
    limit: { type: "number", minimum: 1, maximum: 100, default: 50 },
    offset: { type: "number", minimum: 0, default: 0 },
    action: { type: "string" },
  },
};

export const AuditTrailErrorResponses = {
  400: UserModel.ErrorResponseSchema,
  401: UserModel.ErrorResponseSchema,
  404: UserModel.ErrorResponseSchema,
  500: UserModel.ErrorResponseSchema,
};
