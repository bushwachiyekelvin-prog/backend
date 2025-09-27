// fields to register a business
export var BusinessModel;
(function (BusinessModel) {
    // Fastify JSON Schema for validating request body
    BusinessModel.RegisterBusinessBodySchema = {
        type: "object",
        additionalProperties: false,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", minLength: 1, maxLength: 2000 },
            entityType: { type: "string", minLength: 1, maxLength: 100 },
            country: { type: "string", minLength: 2, maxLength: 100 },
            yearOfIncorporation: {
                type: "integer",
                minimum: 1900,
                maximum: 2100,
            },
            sector: { type: "string", minLength: 1, maxLength: 100 },
            isOwned: { type: "boolean" },
            ownershipPercentage: { type: "number", minimum: 0, maximum: 100 },
            ownershipType: { type: "string", minLength: 1, maxLength: 100 },
        },
        required: [
            "name",
            "entityType",
            "country",
            "yearOfIncorporation",
            "isOwned",
            "sector",
        ],
        allOf: [
            // If isOwned is true, require ownershipPercentage and ownershipType
            {
                if: {
                    properties: { isOwned: { const: true } },
                    required: ["isOwned"],
                },
                then: {
                    required: ["ownershipPercentage", "ownershipType"],
                },
            },
            // If isOwned is false, disallow ownershipPercentage > 0
            {
                if: {
                    properties: { isOwned: { const: false } },
                    required: ["isOwned"],
                },
                then: {
                    properties: { ownershipPercentage: { type: "number", maximum: 0 } },
                },
            },
        ],
    };
    // Fastify JSON Schema for editing a business
    // Body must include at least one of the defined properties
    BusinessModel.EditBusinessBodySchema = {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            description: { type: "string", minLength: 1, maxLength: 2000 },
            imageUrl: { type: "string", minLength: 1 },
            coverImage: { type: "string", minLength: 1 },
            entityType: { type: "string", minLength: 1, maxLength: 100 },
            country: { type: "string", minLength: 2, maxLength: 100 },
            city: { type: "string", minLength: 1, maxLength: 100 },
            address: { type: "string", minLength: 1, maxLength: 200 },
            zipCode: { type: "string", minLength: 1, maxLength: 20 },
            address2: { type: "string", minLength: 1, maxLength: 200 },
            yearOfIncorporation: {
                type: "integer",
                minimum: 1900,
                maximum: 2100,
            },
            sector: { type: "string", minLength: 1, maxLength: 100 },
            isOwned: { type: "boolean" },
            avgMonthlyTurnover: { type: "number", minimum: 0 },
            avgYearlyTurnover: { type: "number", minimum: 0 },
            borrowingHistory: { type: "boolean" },
            amountBorrowed: { type: "number", minimum: 0 },
            loanStatus: { type: "string", minLength: 1, maxLength: 50 },
            defaultReason: { type: "string" },
            currency: { type: "string", minLength: 1, maxLength: 10 },
            ownershipPercentage: { type: "number", minimum: 0, maximum: 100 },
            ownershipType: { type: "string", minLength: 1, maxLength: 100 },
        },
        allOf: [
            // Only when isOwned is provided as true in the update, require ownership fields
            {
                if: {
                    properties: { isOwned: { const: true } },
                    required: ["isOwned"],
                },
                then: {
                    required: ["ownershipPercentage", "ownershipType"],
                },
            },
            // If isOwned is provided as false, and ownershipPercentage is provided, enforce it to be 0
            {
                if: {
                    properties: { isOwned: { const: false } },
                    required: ["isOwned"],
                },
                then: {
                    properties: { ownershipPercentage: { type: "number", maximum: 0 } },
                },
            },
            // If loanStatus is "defaulted", require defaultReason
            {
                if: {
                    properties: { loanStatus: { const: "defaulted" } },
                    required: ["loanStatus"],
                },
                then: {
                    required: ["defaultReason"],
                    properties: { defaultReason: { type: "string", minLength: 1 } },
                },
            },
        ],
    };
    // Common params schema for business id in routes
    BusinessModel.BusinessIdParamsSchema = {
        type: "object",
        additionalProperties: false,
        properties: {
            id: { type: "string", minLength: 1 },
        },
        required: ["id"],
    };
    BusinessModel.BusinessItemSchema = {
        type: "object",
        properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            imageUrl: { type: "string" },
            coverImage: { type: "string" },
            entityType: { type: "string" },
            country: { type: "string" },
            city: { type: "string" },
            address: { type: "string" },
            zipCode: { type: "string" },
            address2: { type: "string" },
            sector: { type: "string" },
            yearOfIncorporation: { type: "string" },
            avgMonthlyTurnover: { type: "number" },
            avgYearlyTurnover: { type: "number" },
            borrowingHistory: { type: "boolean" },
            amountBorrowed: { type: "number" },
            loanStatus: { type: "string" },
            defaultReason: { type: "string" },
            currency: { type: "string" },
            ownershipType: { type: "string" },
            ownershipPercentage: { type: "number" },
            isOwned: { type: "boolean" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
        },
        required: ["id"],
        additionalProperties: true,
    };
    BusinessModel.ListBusinessesResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array", items: BusinessModel.BusinessItemSchema },
        },
        required: ["success", "message", "data"],
        additionalProperties: true,
    };
})(BusinessModel || (BusinessModel = {}));
