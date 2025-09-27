import { loanTermUnitEnum, interestTypeEnum, interestRatePeriodEnum, repaymentFrequencyEnum, amortizationMethodEnum, } from "../../db/schema/loanProducts";
export var LoanProductsModel;
(function (LoanProductsModel) {
    // Term unit values derived from DB enum
    LoanProductsModel.LoanTermUnitEnum = loanTermUnitEnum.enumValues;
    // Interest type values derived from DB enum
    LoanProductsModel.InterestTypeEnum = interestTypeEnum.enumValues;
    // Additional pricing enums
    LoanProductsModel.InterestRatePeriodEnum = interestRatePeriodEnum.enumValues;
    LoanProductsModel.RepaymentFrequencyEnum = repaymentFrequencyEnum.enumValues;
    LoanProductsModel.AmortizationMethodEnum = amortizationMethodEnum.enumValues;
    // JSON Schemas
    LoanProductsModel.CreateLoanProductBodySchema = {
        type: "object",
        additionalProperties: false,
        properties: {
            name: { type: "string", minLength: 1, maxLength: 150 },
            slug: { type: "string", minLength: 1, maxLength: 180 },
            imageUrl: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            currency: { type: "string", minLength: 1, maxLength: 10 },
            minAmount: { type: "number", minimum: 0 },
            maxAmount: { type: "number", minimum: 0 },
            minTerm: { type: "integer", minimum: 0 },
            maxTerm: { type: "integer", minimum: 0 },
            termUnit: { type: "string", enum: LoanProductsModel.LoanTermUnitEnum },
            interestRate: { type: "number", minimum: 0 },
            interestType: { type: "string", enum: LoanProductsModel.InterestTypeEnum },
            ratePeriod: { type: "string", enum: LoanProductsModel.InterestRatePeriodEnum },
            amortizationMethod: { type: "string", enum: LoanProductsModel.AmortizationMethodEnum },
            repaymentFrequency: { type: "string", enum: LoanProductsModel.RepaymentFrequencyEnum },
            processingFeeRate: { type: "number", minimum: 0 },
            processingFeeFlat: { type: "number", minimum: 0 },
            lateFeeRate: { type: "number", minimum: 0 },
            lateFeeFlat: { type: "number", minimum: 0 },
            prepaymentPenaltyRate: { type: "number", minimum: 0 },
            gracePeriodDays: { type: "integer", minimum: 0 },
            isActive: { type: "boolean" },
        },
        required: [
            "name",
            "currency",
            "minAmount",
            "maxAmount",
            "minTerm",
            "maxTerm",
            "termUnit",
            "interestRate",
        ],
        allOf: [
            // Ensure minAmount <= maxAmount
            {
                if: { properties: { minAmount: { type: "number" }, maxAmount: { type: "number" } } },
                then: {
                    properties: {
                        maxAmount: { type: "number", minimum: { $data: "1/minAmount" } },
                    },
                },
            },
            // Ensure minTerm <= maxTerm
            {
                if: { properties: { minTerm: { type: "integer" }, maxTerm: { type: "integer" } } },
                then: {
                    properties: {
                        maxTerm: { type: "integer", minimum: { $data: "1/minTerm" } },
                    },
                },
            },
        ],
    };
    LoanProductsModel.EditLoanProductBodySchema = {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: LoanProductsModel.CreateLoanProductBodySchema.properties,
        allOf: LoanProductsModel.CreateLoanProductBodySchema.allOf,
    };
    LoanProductsModel.LoanProductItemSchema = {
        type: "object",
        properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            imageUrl: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            currency: { type: "string" },
            minAmount: { type: "number" },
            maxAmount: { type: "number" },
            minTerm: { type: "integer" },
            maxTerm: { type: "integer" },
            termUnit: { type: "string", enum: LoanProductsModel.LoanTermUnitEnum },
            interestRate: { type: "number" },
            interestType: { type: "string", enum: LoanProductsModel.InterestTypeEnum },
            ratePeriod: { type: "string", enum: LoanProductsModel.InterestRatePeriodEnum },
            amortizationMethod: { type: "string", enum: LoanProductsModel.AmortizationMethodEnum },
            repaymentFrequency: { type: "string", enum: LoanProductsModel.RepaymentFrequencyEnum },
            processingFeeRate: { type: "number" },
            processingFeeFlat: { type: "number" },
            lateFeeRate: { type: "number" },
            lateFeeFlat: { type: "number" },
            prepaymentPenaltyRate: { type: "number" },
            gracePeriodDays: { type: "integer" },
            isActive: { type: "boolean" },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
        },
        required: [
            "id",
            "name",
            "currency",
            "minAmount",
            "maxAmount",
            "minTerm",
            "maxTerm",
            "termUnit",
            "interestRate",
            "interestType",
            "ratePeriod",
            "amortizationMethod",
            "repaymentFrequency",
            "gracePeriodDays",
            "isActive",
        ],
        additionalProperties: true,
    };
    LoanProductsModel.ListLoanProductsResponseSchema = {
        type: "object",
        properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array", items: LoanProductsModel.LoanProductItemSchema },
        },
        required: ["success", "message", "data"],
        additionalProperties: true,
    };
})(LoanProductsModel || (LoanProductsModel = {}));
