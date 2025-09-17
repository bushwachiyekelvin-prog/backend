// fields to register a business

export namespace BusinessModel {
  // TypeScript type for the service layer input
  export interface RegisterBusinessInput {
    name: string;
    description: string;
    entityType: string;
    country: string; // ISO country code or country name
    yearOfIncorporation: number; // four-digit year
    isOwned: boolean;
    sector: string// whether the current user owns equity in this business
    ownershipPercentage?: number; // 0..100, required when isOwned=true
    ownershipType?: string; // e.g., individual | joint | company | government | trust | other
  }

  // Fastify JSON Schema for validating request body
  export const RegisterBusinessBodySchema = {
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
  } as const;
}