import { LoanApplicationsModel } from "./loan-applications.model";

export namespace LoanApplicationsSchemas {
  // ========================================
  // CREATE LOAN APPLICATION SCHEMAS
  // ========================================
  export const CreateLoanApplicationBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      loanProductId: { type: "string", minLength: 1 },
      businessId: { type: "string", minLength: 1 },
      coApplicantIds: { 
        type: "array", 
        items: { type: "string", minLength: 1 },
        uniqueItems: true 
      },
      loanAmount: { type: "number", minimum: 0 },
      loanTerm: { type: "integer", minimum: 1 },
      currency: { type: "string", minLength: 3, maxLength: 10 },
      purpose: { type: "string", enum: LoanApplicationsModel.LoanPurposeEnum },
      purposeDescription: { type: "string", minLength: 1, maxLength: 500 },
      isBusinessLoan: { type: "boolean" },
    },
    required: [
      "loanProductId",
      "loanAmount",
      "loanTerm",
      "currency",
      "purpose",
      "isBusinessLoan",
    ],
    allOf: [
      // If purpose is "other", require purposeDescription
      {
        if: { properties: { purpose: { const: "other" } }, required: ["purpose"] },
        then: { required: ["purposeDescription"] },
      },
      // If isBusinessLoan is true, require businessId
      {
        if: { properties: { isBusinessLoan: { const: true } }, required: ["isBusinessLoan"] },
        then: { required: ["businessId"] },
      },
    ],
  } as const;

  // ========================================
  // UPDATE LOAN APPLICATION SCHEMAS
  // ========================================
  export const UpdateLoanApplicationBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      loanAmount: { type: "number", minimum: 0 },
      loanTerm: { type: "integer", minimum: 1 },
      purpose: { type: "string", enum: LoanApplicationsModel.LoanPurposeEnum },
      purposeDescription: { type: "string", minLength: 1, maxLength: 500 },
      coApplicantIds: { 
        type: "array", 
        items: { type: "string", minLength: 1 },
        uniqueItems: true 
      },
    },
    allOf: [
      // If purpose is "other", require purposeDescription
      {
        if: { properties: { purpose: { const: "other" } }, required: ["purpose"] },
        then: { required: ["purposeDescription"] },
      },
    ],
  } as const;

  // ========================================
  // LOAN APPLICATION ITEM SCHEMAS
  // ========================================
  export const LoanApplicationItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      applicationNumber: { type: "string" },
      userId: { type: "string" },
      businessId: { type: "string" },
      loanProductId: { type: "string" },
      coApplicantIds: { type: "string" },
      loanAmount: { type: "number" },
      loanTerm: { type: "integer" },
      currency: { type: "string" },
      purpose: { type: "string", enum: LoanApplicationsModel.LoanPurposeEnum },
      purposeDescription: { type: "string" },
      status: { type: "string", enum: LoanApplicationsModel.LoanApplicationStatusEnum },
      isBusinessLoan: { type: "boolean" },
      submittedAt: { type: "string" },
      reviewedAt: { type: "string" },
      approvedAt: { type: "string" },
      disbursedAt: { type: "string" },
      rejectedAt: { type: "string" },
      rejectionReason: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
      user: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
        },
        required: ["id", "email"],
      },
      business: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
      loanProduct: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          currency: { type: "string" },
          minAmount: { type: "number" },
          maxAmount: { type: "number" },
          minTerm: { type: "integer" },
          maxTerm: { type: "integer" },
          termUnit: { type: "string" },
          interestRate: { type: "number" },
        },
        required: ["id", "name", "currency", "minAmount", "maxAmount", "minTerm", "maxTerm", "termUnit", "interestRate"],
      },
      offerLetters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            loanApplicationId: { type: "string" },
            offerNumber: { type: "string" },
            version: { type: "integer" },
            offerAmount: { type: "number" },
            offerTerm: { type: "integer" },
            interestRate: { type: "number" },
            currency: { type: "string" },
            status: { type: "string" },
            isActive: { type: "boolean" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
    required: [
      "id",
      "applicationNumber",
      "userId",
      "loanProductId",
      "loanAmount",
      "loanTerm",
      "currency",
      "purpose",
      "status",
      "isBusinessLoan",
      "createdAt",
      "updatedAt",
    ],
    additionalProperties: true,
  } as const;

  // ========================================
  // RESPONSE SCHEMAS
  // ========================================
  export const CreateLoanApplicationResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: LoanApplicationItemSchema,
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export const ListLoanApplicationsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: LoanApplicationItemSchema },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
        required: ["page", "limit", "total", "totalPages"],
      },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export const GetLoanApplicationResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: LoanApplicationItemSchema,
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export const UpdateLoanApplicationResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: LoanApplicationItemSchema,
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export const BasicSuccessResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
    },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;

  // ========================================
  // QUERY PARAMETER SCHEMAS
  // ========================================
  export const LoanApplicationIdParamsSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1 },
    },
    required: ["id"],
  } as const;

  export const ListLoanApplicationsQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "string", pattern: "^[0-9]+$" },
      limit: { type: "string", pattern: "^[0-9]+$" },
      status: { type: "string", enum: LoanApplicationsModel.LoanApplicationStatusEnum },
      isBusinessLoan: { type: "string", enum: ["true", "false"] },
      userId: { type: "string", minLength: 1 },
      businessId: { type: "string", minLength: 1 },
      loanProductId: { type: "string", minLength: 1 },
    },
  } as const;

  // ========================================
  // STATUS UPDATE SCHEMAS
  // ========================================
  export const UpdateApplicationStatusBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: LoanApplicationsModel.LoanApplicationStatusEnum },
      rejectionReason: { type: "string", minLength: 1, maxLength: 500 },
    },
    required: ["status"],
    allOf: [
      // If status is "rejected", require rejectionReason
      {
        if: { properties: { status: { const: "rejected" } }, required: ["status"] },
        then: { required: ["rejectionReason"] },
      },
    ],
  } as const;
}
