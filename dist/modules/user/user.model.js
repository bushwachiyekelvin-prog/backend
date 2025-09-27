export var UserModel;
(function (UserModel) {
    UserModel.ErrorResponseSchema = {
        type: "object",
        properties: {
            error: { type: "string" },
            code: { type: "string" },
        },
        required: ["error", "code"],
        additionalProperties: true,
    };
    UserModel.SignUpResponseSchema = {
        type: "object",
        properties: { email: { type: "string" } },
        required: ["email"],
        additionalProperties: true,
    };
    UserModel.OtpRequestBodySchema = {
        type: "object",
        additionalProperties: false,
        properties: {},
    };
    UserModel.OtpVerificationBodySchema = {
        type: "object",
        properties: { otp: { type: "string" } },
        required: ["otp"],
        additionalProperties: false,
    };
    UserModel.OtpResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            isAlreadyVerified: { type: "boolean" },
        },
        required: ["success", "message"],
        additionalProperties: true,
    };
    UserModel.BasicSuccessResponseSchema = {
        type: "object",
        properties: { success: { type: "boolean" }, message: { type: "string" } },
        required: ["success", "message"],
        additionalProperties: true,
    };
    UserModel.EditPhoneBodySchema = {
        type: "object",
        properties: { phoneNumber: { type: "string" } },
        required: ["phoneNumber"],
        additionalProperties: false,
    };
    UserModel.EditPhoneResponseSchema = UserModel.BasicSuccessResponseSchema;
    UserModel.OtpVerificationResponseSchema = UserModel.BasicSuccessResponseSchema;
    UserModel.PersonalDocumentItemSchema = {
        type: "object",
        properties: {
            docType: {
                type: "string",
                enum: [
                    "national_id_front",
                    "national_id_back",
                    "passport_bio_page",
                    "personal_tax_document",
                    "user_photo"
                ],
            },
            docUrl: { type: "string", minLength: 1, format: "uri" },
        },
        required: ["docType", "docUrl"],
        additionalProperties: false,
    };
    UserModel.UpdateUserAndDocumentsBodySchema = {
        type: "object",
        properties: {
            idNumber: { type: "string", minLength: 1, maxLength: 50 },
            taxNumber: { type: "string", minLength: 1, maxLength: 50 },
            idType: { type: "string", enum: ["national_id", "passport"] },
            documents: { type: "array", items: UserModel.PersonalDocumentItemSchema, minItems: 1 },
        },
        required: ["idNumber", "taxNumber", "idType", "documents"],
        additionalProperties: false,
        allOf: [
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
    };
    UserModel.UpdateUserAndDocumentsResponseSchema = UserModel.BasicSuccessResponseSchema;
    // JSON Schema: does not include email or phoneNumber and sets
    // additionalProperties to false to prevent their presence.
    UserModel.EditUserProfileBodySchema = {
        type: "object",
        properties: {
            firstName: { type: "string", minLength: 1, maxLength: 100 },
            lastName: { type: "string", minLength: 1, maxLength: 100 },
            imageUrl: { type: "string" },
            gender: { type: "string", minLength: 1, maxLength: 20 },
            idNumber: { type: "string", minLength: 1, maxLength: 50 },
            taxNumber: { type: "string", minLength: 1, maxLength: 50 },
            // Accept ISO date-time strings; service layer can coerce to Date
            dob: { type: "string", format: "date-time" },
            idType: { type: "string", enum: ["national_id", "passport"] },
            role: { type: "string", minLength: 1, maxLength: 50 },
            position: { type: "string", minLength: 1, maxLength: 50 },
        },
        required: [],
        additionalProperties: false,
    };
    UserModel.EditUserProfileResponseSchema = UserModel.BasicSuccessResponseSchema;
    UserModel.GetUserProfileResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
                type: "object",
                properties: {
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    imageUrl: { type: "string" },
                    gender: { type: "string" },
                    idNumber: { type: "string" },
                    taxNumber: { type: "string" },
                    dob: { type: "string" },
                    idType: { type: "string" },
                    role: { type: "string" },
                    position: { type: "string" },
                    email: { type: "string" },
                    phoneNumber: { type: "string" },
                },
            },
        },
        required: ["success", "message"],
        additionalProperties: true,
    };
})(UserModel || (UserModel = {}));
