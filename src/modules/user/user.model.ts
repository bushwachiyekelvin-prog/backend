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
}
