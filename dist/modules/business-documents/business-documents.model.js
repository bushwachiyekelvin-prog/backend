export var BusinessDocumentsModel;
(function (BusinessDocumentsModel) {
    // Keep a local runtime enum list to power JSON Schema (must be string[])
    BusinessDocumentsModel.BusinessDocumentTypeEnum = [
        "business_registration",
        "articles_of_association",
        "business_permit",
        "tax_registration_certificate",
        "certificate_of_incorporation",
        "tax_clearance_certificate",
        "partnership_deed",
        "memorandum_of_association",
        "business_plan",
        "pitch_deck",
        "annual_bank_statement",
        "audited_financial_statements",
    ];
    BusinessDocumentsModel.BusinessIdParamsSchema = {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"],
    };
    // JSON Schema for a single business document item
    BusinessDocumentsModel.BusinessDocumentItemSchema = {
        type: "object",
        additionalProperties: false,
        properties: {
            docType: { type: "string", enum: BusinessDocumentsModel.BusinessDocumentTypeEnum },
            docUrl: { type: "string", minLength: 1, format: "uri" },
            isPasswordProtected: { type: "boolean" },
            docPassword: { type: "string", minLength: 1, maxLength: 200 },
            docBankName: { type: "string", minLength: 1, maxLength: 100 },
            docYear: { type: "integer", minimum: 1900, maximum: 2100 },
        },
        required: ["docType", "docUrl"],
        allOf: [
            // If isPasswordProtected true -> require docPassword
            {
                if: { properties: { isPasswordProtected: { const: true } }, required: ["isPasswordProtected"] },
                then: { required: ["docPassword"] },
            },
            // If docType is audited_financial_statements -> require docYear
            {
                if: { properties: { docType: { const: "audited_financial_statements" } }, required: ["docType"] },
                then: { required: ["docYear"] },
            },
            // If docType is annual_bank_statement -> require docYear and docBankName
            {
                if: { properties: { docType: { const: "annual_bank_statement" } }, required: ["docType"] },
                then: { required: ["docYear", "docBankName"] },
            },
        ],
    };
    // Accept either a single document object or an array of document objects (min 1)
    BusinessDocumentsModel.AddDocumentsBodySchema = {
        anyOf: [
            BusinessDocumentsModel.BusinessDocumentItemSchema,
            { type: "array", items: BusinessDocumentsModel.BusinessDocumentItemSchema, minItems: 1 },
        ],
        additionalProperties: false,
    };
    BusinessDocumentsModel.AddDocumentsResponseSchema = {
        type: "object",
        properties: { success: { type: "boolean" }, message: { type: "string" } },
        required: ["success", "message"],
        additionalProperties: true,
    };
    BusinessDocumentsModel.ListDocumentsResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array", items: BusinessDocumentsModel.BusinessDocumentItemSchema },
        },
        required: ["success", "message", "data"],
        additionalProperties: true,
    };
})(BusinessDocumentsModel || (BusinessDocumentsModel = {}));
