export var InvestorOpportunitiesModel;
(function (InvestorOpportunitiesModel) {
    InvestorOpportunitiesModel.CreateInvestorOpportunityBodySchema = {
        type: "object",
        additionalProperties: false,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 200 },
            countryOfOrigin: { type: "string", maxLength: 120 },
            totalFundSize: { type: "string", maxLength: 120 },
            sectorFocusSsa: { type: "string" },
            countriesOfOperation: { type: "string" },
            operatingSince: { type: "string", maxLength: 50 },
            website: { type: "string", maxLength: 300 },
            isActive: { type: "boolean" },
        },
        required: ["name"],
    };
    InvestorOpportunitiesModel.EditInvestorOpportunityBodySchema = {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: InvestorOpportunitiesModel.CreateInvestorOpportunityBodySchema.properties,
    };
    InvestorOpportunitiesModel.InvestorOpportunityItemSchema = {
        type: "object",
        properties: {
            id: { type: "string" },
            name: { type: "string" },
            countryOfOrigin: { type: "string" },
            totalFundSize: { type: "string" },
            sectorFocusSsa: { type: "string" },
            countriesOfOperation: { type: "string" },
            operatingSince: { type: "string" },
            website: { type: "string" },
            isActive: { type: "boolean" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
        },
        required: ["id", "name", "isActive"],
        additionalProperties: true,
    };
    InvestorOpportunitiesModel.ListInvestorOpportunitiesResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array", items: InvestorOpportunitiesModel.InvestorOpportunityItemSchema },
        },
        required: ["success", "message", "data"],
        additionalProperties: true,
    };
    InvestorOpportunitiesModel.ListBookmarkedInvestorOpportunitiesResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array", items: InvestorOpportunitiesModel.InvestorOpportunityItemSchema },
        },
        required: ["success", "message", "data"],
        additionalProperties: true,
    };
})(InvestorOpportunitiesModel || (InvestorOpportunitiesModel = {}));
