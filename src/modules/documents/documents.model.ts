import { UserModel } from "../user/user.model";

export namespace DocumentsModel {
  // Re-export the PersonalDocType for convenience within this module
  export type PersonalDocType = UserModel.PersonalDocType;

  // Input types
  export type AddDocumentsBody = UserModel.PersonalDocument | UserModel.PersonalDocument[];

  // JSON Schemas
  // Accept either a single document object or an array of document objects (min 1)
  export const AddDocumentsBodySchema = {
    anyOf: [
      UserModel.PersonalDocumentItemSchema,
      { type: "array", items: UserModel.PersonalDocumentItemSchema, minItems: 1 },
    ],
    additionalProperties: false,
  } as const;

  // Basic success response for add/upsert
  export type AddDocumentsResponse = UserModel.BasicSuccessResponse;
  export const AddDocumentsResponseSchema = UserModel.BasicSuccessResponseSchema;

  // Listing response
  export interface ListDocumentsResponse {
    success: boolean;
    message: string;
    data: UserModel.PersonalDocument[];
  }

  export const ListDocumentsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: UserModel.PersonalDocumentItemSchema },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
