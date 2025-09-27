import { UserModel } from "../user/user.model";
export var DocumentsModel;
(function (DocumentsModel) {
    // JSON Schemas
    // Accept either a single document object or an array of document objects (min 1)
    DocumentsModel.AddDocumentsBodySchema = {
        anyOf: [
            UserModel.PersonalDocumentItemSchema,
            { type: "array", items: UserModel.PersonalDocumentItemSchema, minItems: 1 },
        ],
        additionalProperties: false,
    };
    DocumentsModel.AddDocumentsResponseSchema = UserModel.BasicSuccessResponseSchema;
    DocumentsModel.ListDocumentsResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array", items: UserModel.PersonalDocumentItemSchema },
        },
        required: ["success", "message", "data"],
        additionalProperties: true,
    };
})(DocumentsModel || (DocumentsModel = {}));
