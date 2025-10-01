import { UserModel } from "../../modules/user/user.model";

export const SnapshotResponseSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    message: { type: "string" },
    data: {
      type: "object",
      properties: {
        id: { type: "string" },
        loanApplicationId: { type: "string" },
        createdBy: { type: "string" },
        snapshotData: { type: "object" },
        approvalStage: { type: "string" },
        createdAt: { type: "string" },
        creator: {
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

export const SnapshotsListResponseSchema = {
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
          createdBy: { type: "string" },
          snapshotData: { type: "object" },
          approvalStage: { type: "string" },
          createdAt: { type: "string" },
          creator: {
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

export const SnapshotErrorResponses = {
  400: UserModel.ErrorResponseSchema,
  401: UserModel.ErrorResponseSchema,
  404: UserModel.ErrorResponseSchema,
  500: UserModel.ErrorResponseSchema,
};
