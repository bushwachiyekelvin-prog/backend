import {
  offerLetters,
  offerLetterStatusEnum,
  docuSignStatusEnum,
} from "../../db/schema/offerLetters";
import { LoanApplicationsModel } from "../loan-applications/loan-applications.model";

export namespace OfferLettersModel {
  // Status enums derived from DB
  export const OfferLetterStatusEnum = offerLetterStatusEnum.enumValues;
  export type OfferLetterStatus = (typeof offerLetters.$inferSelect)["status"];

  export const DocuSignStatusEnum = docuSignStatusEnum.enumValues;
  export type DocuSignStatus = (typeof offerLetters.$inferSelect)["docuSignStatus"];

  // ========================================
  // CREATE OFFER LETTER
  // ========================================
  export interface CreateOfferLetterBody {
    loanApplicationId: string;
    offerAmount: number;
    offerTerm: number;
    interestRate: number;
    currency: string;
    specialConditions?: string;
    requiresGuarantor?: boolean;
    requiresCollateral?: boolean;
    recipientEmail: string;
    recipientName: string;
    expiresAt: string; // ISO date string
    docuSignTemplateId?: string;
    notes?: string;
  }

  export const CreateOfferLetterBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      loanApplicationId: { type: "string", minLength: 1 },
      offerAmount: { type: "number", minimum: 0 },
      offerTerm: { type: "integer", minimum: 1 },
      interestRate: { type: "number", minimum: 0 },
      currency: { type: "string", minLength: 3, maxLength: 10 },
      specialConditions: { type: "string", maxLength: 1000 },
      requiresGuarantor: { type: "boolean", default: false },
      requiresCollateral: { type: "boolean", default: false },
      recipientEmail: { type: "string", format: "email" },
      recipientName: { type: "string", minLength: 1, maxLength: 200 },
      expiresAt: { type: "string", format: "date-time" },
      docuSignTemplateId: { type: "string", minLength: 1 },
      notes: { type: "string", maxLength: 500 },
    },
    required: [
      "loanApplicationId",
      "offerAmount",
      "offerTerm",
      "interestRate",
      "currency",
      "recipientEmail",
      "recipientName",
      "expiresAt",
    ],
  } as const;

  // ========================================
  // UPDATE OFFER LETTER
  // ========================================
  export interface UpdateOfferLetterBody {
    offerAmount?: number;
    offerTerm?: number;
    interestRate?: number;
    specialConditions?: string;
    requiresGuarantor?: boolean;
    requiresCollateral?: boolean;
    recipientEmail?: string;
    recipientName?: string;
    expiresAt?: string;
    notes?: string;
  }

  export const UpdateOfferLetterBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      offerAmount: { type: "number", minimum: 0 },
      offerTerm: { type: "integer", minimum: 1 },
      interestRate: { type: "number", minimum: 0 },
      specialConditions: { type: "string", maxLength: 1000 },
      requiresGuarantor: { type: "boolean" },
      requiresCollateral: { type: "boolean" },
      recipientEmail: { type: "string", format: "email" },
      recipientName: { type: "string", minLength: 1, maxLength: 200 },
      expiresAt: { type: "string", format: "date-time" },
      notes: { type: "string", maxLength: 500 },
    },
  } as const;

  // ========================================
  // OFFER LETTER ITEM
  // ========================================
  export interface OfferLetterItem {
    id: string;
    loanApplicationId: string;
    offerNumber: string;
    version: number;
    offerAmount: number;
    offerTerm: number;
    interestRate: number;
    currency: string;
    specialConditions?: string | null;
    requiresGuarantor: boolean;
    requiresCollateral: boolean;
    docuSignEnvelopeId?: string | null;
    docuSignStatus: DocuSignStatus;
    docuSignTemplateId?: string | null;
    offerLetterUrl?: string | null;
    signedDocumentUrl?: string | null;
    recipientEmail: string;
    recipientName: string;
    sentAt?: string | null;
    deliveredAt?: string | null;
    viewedAt?: string | null;
    signedAt?: string | null;
    declinedAt?: string | null;
    expiredAt?: string | null;
    expiresAt: string;
    reminderSentAt?: string | null;
    status: OfferLetterStatus;
    isActive: boolean;
    createdBy?: string | null;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    // Related data
    loanApplication?: {
      id: string;
      applicationNumber: string;
      loanAmount: number;
      loanTerm: number;
      currency: string;
      purpose: string;
      status: string;
    };
  }

  export const OfferLetterItemSchema = {
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
      specialConditions: { type: "string" },
      requiresGuarantor: { type: "boolean" },
      requiresCollateral: { type: "boolean" },
      docuSignEnvelopeId: { type: "string" },
      docuSignStatus: { type: "string", enum: DocuSignStatusEnum },
      docuSignTemplateId: { type: "string" },
      offerLetterUrl: { type: "string" },
      signedDocumentUrl: { type: "string" },
      recipientEmail: { type: "string" },
      recipientName: { type: "string" },
      sentAt: { type: "string" },
      deliveredAt: { type: "string" },
      viewedAt: { type: "string" },
      signedAt: { type: "string" },
      declinedAt: { type: "string" },
      expiredAt: { type: "string" },
      expiresAt: { type: "string" },
      reminderSentAt: { type: "string" },
      status: { type: "string", enum: OfferLetterStatusEnum },
      isActive: { type: "boolean" },
      createdBy: { type: "string" },
      notes: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
      loanApplication: {
        type: "object",
        properties: {
          id: { type: "string" },
          applicationNumber: { type: "string" },
          loanAmount: { type: "number" },
          loanTerm: { type: "integer" },
          currency: { type: "string" },
          purpose: { type: "string" },
          status: { type: "string" },
        },
        required: ["id", "applicationNumber", "loanAmount", "loanTerm", "currency", "purpose", "status"],
      },
    },
    required: [
      "id",
      "loanApplicationId",
      "offerNumber",
      "version",
      "offerAmount",
      "offerTerm",
      "interestRate",
      "currency",
      "requiresGuarantor",
      "requiresCollateral",
      "docuSignStatus",
      "recipientEmail",
      "recipientName",
      "expiresAt",
      "status",
      "isActive",
      "createdAt",
      "updatedAt",
    ],
    additionalProperties: true,
  } as const;

  // ========================================
  // RESPONSE TYPES
  // ========================================
  export interface CreateOfferLetterResponse {
    success: boolean;
    message: string;
    data: OfferLetterItem;
  }

  export const CreateOfferLetterResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: OfferLetterItemSchema,
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export interface ListOfferLettersResponse {
    success: boolean;
    message: string;
    data: OfferLetterItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export const ListOfferLettersResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: OfferLetterItemSchema },
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

  export interface GetOfferLetterResponse {
    success: boolean;
    message: string;
    data: OfferLetterItem;
  }

  export const GetOfferLetterResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: OfferLetterItemSchema,
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export interface UpdateOfferLetterResponse {
    success: boolean;
    message: string;
    data: OfferLetterItem;
  }

  export const UpdateOfferLetterResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: OfferLetterItemSchema,
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;

  export interface BasicSuccessResponse {
    success: boolean;
    message: string;
  }

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
  // QUERY PARAMETERS
  // ========================================
  export interface OfferLetterIdParams {
    id: string;
  }

  export const OfferLetterIdParamsSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string", minLength: 1 },
    },
    required: ["id"],
  } as const;

  export interface ListOfferLettersQuery {
    page?: number;
    limit?: number;
    status?: OfferLetterStatus;
    docuSignStatus?: DocuSignStatus;
    loanApplicationId?: string;
    isActive?: boolean;
    expiresBefore?: string; // ISO date string
  }

  export const ListOfferLettersQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      status: { type: "string", enum: OfferLetterStatusEnum },
      docuSignStatus: { type: "string", enum: DocuSignStatusEnum },
      loanApplicationId: { type: "string", minLength: 1 },
      isActive: { type: "boolean" },
      expiresBefore: { type: "string", format: "date-time" },
    },
  } as const;

  // ========================================
  // DOCUSIGN WEBHOOK TYPES
  // ========================================
  export interface DocuSignWebhookBody {
    envelopeId: string;
    status: DocuSignStatus;
    statusChangedDateTime: string;
    recipients?: {
      recipientId: string;
      email: string;
      status: string;
      statusChangedDateTime: string;
    }[];
  }

  export const DocuSignWebhookBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      envelopeId: { type: "string", minLength: 1 },
      status: { type: "string", enum: DocuSignStatusEnum },
      statusChangedDateTime: { type: "string", format: "date-time" },
      recipients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            recipientId: { type: "string" },
            email: { type: "string", format: "email" },
            status: { type: "string" },
            statusChangedDateTime: { type: "string", format: "date-time" },
          },
          required: ["recipientId", "email", "status", "statusChangedDateTime"],
        },
      },
    },
    required: ["envelopeId", "status", "statusChangedDateTime"],
  } as const;

  // ========================================
  // SEND OFFER LETTER
  // ========================================
  export interface SendOfferLetterBody {
    docuSignTemplateId: string;
    recipientEmail: string;
    recipientName: string;
    customFields?: Record<string, any>; // For DocuSign template fields
  }

  export const SendOfferLetterBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      docuSignTemplateId: { type: "string", minLength: 1 },
      recipientEmail: { type: "string", format: "email" },
      recipientName: { type: "string", minLength: 1, maxLength: 200 },
      customFields: { type: "object" },
    },
    required: ["docuSignTemplateId", "recipientEmail", "recipientName"],
  } as const;

  export interface SendOfferLetterResponse {
    success: boolean;
    message: string;
    data: {
      envelopeId: string;
      offerLetterUrl: string;
    };
  }

  export const SendOfferLetterResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: {
        type: "object",
        properties: {
          envelopeId: { type: "string" },
          offerLetterUrl: { type: "string" },
        },
        required: ["envelopeId", "offerLetterUrl"],
      },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}


