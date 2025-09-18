// Reusable types and JSON Schemas for User module (no Elysia dependency)

export namespace UserModel {
  // TypeScript types
  export interface SignUpBody {
    email: string;
    firstName: string;
    lastName: string;
    gender: string;
    phoneNumber: string;
    dob: string | Date;
    clerkId: string;
  }

  export interface SignUpResponse {
    email: string;
  }

  export interface ErrorResponse {
    error: string;
    code: string;
  }

  export interface OtpRequestBody {}

  export interface OtpVerificationBody {
    otp: string;
  }

  export interface OtpResponse {
    success: boolean;
    message: string;
    isAlreadyVerified?: boolean;
  }

  // Shared success response (success + message)
  export interface BasicSuccessResponse {
    success: boolean;
    message: string;
  }

  export type OtpVerificationResponse = BasicSuccessResponse;

  // Response type for editing phone number, aligned with EditPhoneResponseSchema
  export type EditPhoneResponse = BasicSuccessResponse;

  // JSON Schemas for Fastify
  export const ErrorResponseSchema = {
    type: "object",
    properties: {
      error: { type: "string" },
      code: { type: "string" },
    },
    required: ["error", "code"],
    additionalProperties: true,
  } as const;

  export const SignUpResponseSchema = {
    type: "object",
    properties: { email: { type: "string" } },
    required: ["email"],
    additionalProperties: true,
  } as const;

  export const OtpRequestBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {},
  } as const;

  export const OtpVerificationBodySchema = {
    type: "object",
    properties: { otp: { type: "string" } },
    required: ["otp"],
    additionalProperties: false,
  } as const;

  export const OtpResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      isAlreadyVerified: { type: "boolean" },
    },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;

  // Shared JSON schema for success + message responses
  export const BasicSuccessResponseSchema = {
    type: "object",
    properties: { success: { type: "boolean" }, message: { type: "string" } },
    required: ["success", "message"],
    additionalProperties: true,
  } as const;

  export const EditPhoneBodySchema = {
    type: "object",
    properties: { phoneNumber: { type: "string" } },
    required: ["phoneNumber"],
    additionalProperties: false,
  } as const;

  export const EditPhoneResponseSchema = BasicSuccessResponseSchema;

  export const OtpVerificationResponseSchema = BasicSuccessResponseSchema;

  // Types and Schemas for updating user info along with personal documents
  // Doc type enum (snake_case, stable API surface)
  export type PersonalDocType =
    | "national_id_front"
    | "national_id_back"
    | "passport_bio_page"
    | "personal_tax_document";

  // ID type enum used to drive conditional validation (snake_case)
  export type UserIdType = "national_id" | "passport";

  export interface PersonalDocument {
    docType: PersonalDocType;
    docUrl: string;
  }

  export interface UpdateUserAndDocumentsBody {
    idNumber: string;
    taxNumber: string;
    idType: UserIdType;
    documents: PersonalDocument[];
  }

  // JSON Schemas
  export const PersonalDocumentItemSchema = {
    type: "object",
    properties: {
      docType: {
        type: "string",
        enum: [
          "national_id_front",
          "national_id_back",
          "passport_bio_page",
          "personal_tax_document",
        ],
      },
      docUrl: { type: "string", minLength: 1, format: "uri" },
    },
    required: ["docType", "docUrl"],
    additionalProperties: false,
  } as const;

  export const UpdateUserAndDocumentsBodySchema = {
    type: "object",
    properties: {
      idNumber: { type: "string", minLength: 1, maxLength: 50 },
      taxNumber: { type: "string", minLength: 1, maxLength: 50 },
      idType: { type: "string", enum: ["national_id", "passport"] },
      documents: { type: "array", items: PersonalDocumentItemSchema, minItems: 1 },
    },
    required: ["idNumber", "taxNumber", "idType", "documents"],
    additionalProperties: false,
    allOf: [
      // If idType is nationalID, require presence of both nationalIdFront and nationalIdBack
      {
        if: { properties: { idType: { const: "national_id" } }, required: ["idType"] },
        then: {
          allOf: [
            {
              properties: {
                documents: {
                  type: "array",
                  contains: {
                    type: "object",
                    properties: { docType: { const: "national_id_front" } },
                    required: ["docType"],
                  },
                },
              },
            },
            {
              properties: {
                documents: {
                  type: "array",
                  contains: {
                    type: "object",
                    properties: { docType: { const: "national_id_back" } },
                    required: ["docType"],
                  },
                },
              },
            },
          ],
        },
      },
      // If idType is passport, require presence of passportbiopage
      {
        if: { properties: { idType: { const: "passport" } }, required: ["idType"] },
        then: {
          properties: {
            documents: {
              type: "array",
              contains: {
                type: "object",
                properties: { docType: { const: "passport_bio_page" } },
                required: ["docType"],
              },
            },
          },
        },
      },
    ],
  } as const;

  // Reuse the shared success response or customize as needed
  export const UpdateUserAndDocumentsResponseSchema = BasicSuccessResponseSchema;
}
