import { UserModel } from "../../modules/user/user.model";

export const DocumentRequestResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        id: { type: "string" },
        loanApplicationId: { type: "string" },
        requestedBy: { type: "string" },
        requestedFrom: { type: "string" },
        documentType: { type: "string" },
        description: { type: "string" },
        isRequired: { type: "boolean" },
        status: { type: "string" },
        fulfilledAt: { type: "string", nullable: true },
        fulfilledWith: { type: "string", nullable: true },
        createdAt: { type: "string" },
        updatedAt: { type: "string" },
        requester: {
          type: "object",
          properties: {
            id: { type: "string" },
            firstName: { type: "string", nullable: true },
            lastName: { type: "string", nullable: true },
            email: { type: "string" },
          },
        },
        requestee: {
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
};

export const DocumentRequestsListResponseSchema = {
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
          requestedBy: { type: "string" },
          requestedFrom: { type: "string" },
          documentType: { type: "string" },
          description: { type: "string" },
          isRequired: { type: "boolean" },
          status: { type: "string" },
          fulfilledAt: { type: "string", nullable: true },
          fulfilledWith: { type: "string", nullable: true },
          createdAt: { type: "string" },
          updatedAt: { type: "string" },
          requester: {
            type: "object",
            properties: {
              id: { type: "string" },
              firstName: { type: "string", nullable: true },
              lastName: { type: "string", nullable: true },
              email: { type: "string" },
            },
          },
          requestee: {
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

export const DocumentRequestStatisticsResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        totalRequests: { type: "number" },
        pendingRequests: { type: "number" },
        fulfilledRequests: { type: "number" },
        overdueRequests: { type: "number" },
        requestsByType: { type: "object" },
        requestsByStatus: { type: "object" },
      },
    },
  },
};

export const DocumentRequestQuerySchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    documentType: { type: "string" },
    limit: { type: "number", minimum: 1, maximum: 100, default: 50 },
    offset: { type: "number", minimum: 0, default: 0 },
  },
};

export const DocumentRequestErrorResponses = {
  400: UserModel.ErrorResponseSchema,
  401: UserModel.ErrorResponseSchema,
  404: UserModel.ErrorResponseSchema,
  500: UserModel.ErrorResponseSchema,
};
