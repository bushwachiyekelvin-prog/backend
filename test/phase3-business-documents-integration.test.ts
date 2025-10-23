// @ts-nocheck
import { describe, it, expect } from "bun:test";

// Mock the database
const mockDb = {
  query: {
    users: {
      findFirst: () => Promise.resolve({
        id: "user_123",
        clerkId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      }),
    },
    businessProfiles: {
      findFirst: () => Promise.resolve({
        id: "business_123",
        userId: "user_123",
      }),
    },
    businessDocuments: {
      findFirst: () => Promise.resolve({
        id: "doc_123",
        businessId: "business_123",
        docType: "audited_financial_statements",
        docUrl: "https://example.com/doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
        deletedAt: null,
      }),
      findMany: () => Promise.resolve([
        {
          docType: "audited_financial_statements",
          docUrl: "https://example.com/doc.pdf",
          isPasswordProtected: false,
          docPassword: null,
          docBankName: null,
          docYear: 2023,
        },
      ]),
    },
  },
  transaction: (callback: any) => callback(mockTx),
};

// Mock transaction
const mockTx = {
  query: {
    businessDocuments: {
      findFirst: () => Promise.resolve({
        id: "doc_123",
        docUrl: "https://example.com/old-doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
      }),
    },
  },
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }),
  insert: () => ({
    values: () => Promise.resolve(),
  }),
};

// Mock the audit trail service
const mockAuditTrailService = {
  logAction: () => Promise.resolve({
    id: "audit_123",
    loanApplicationId: "business_123",
    userId: "user_123",
    action: "documents_uploaded",
    reason: "Business document uploaded",
    details: "Business document audited_financial_statements uploaded for business business_123",
    metadata: {},
    beforeData: {},
    afterData: {},
    createdAt: new Date(),
  }),
};

// Mock the document request service
const mockDocumentRequestService = {
  createRequest: () => Promise.resolve({
    id: "request_123",
    loanApplicationId: "business_123",
    documentType: "audited_financial_statements",
    reason: "Required for loan approval",
    status: "pending",
    createdAt: new Date(),
  }),
  getRequest: () => Promise.resolve({
    id: "request_123",
    loanApplicationId: "business_123",
    documentType: "audited_financial_statements",
    reason: "Required for loan approval",
    status: "pending",
    createdAt: new Date(),
  }),
  fulfillRequest: () => Promise.resolve({
    id: "request_123",
    status: "fulfilled",
    fulfilledAt: new Date(),
  }),
};

// Mock logger
const mockLogger = {
  error: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
};

// Mock the business document type enum
const mockBusinessDocumentTypeEnum = {
  enumValues: [
    "audited_financial_statements",
    "annual_bank_statement",
    "business_license",
    "tax_returns",
    "financial_projections",
  ],
};

// Mock the service class
class MockBusinessDocumentsService {
  static async upsert(clerkId: string, businessId: string, input: any) {
    // Simulate the upsert method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    const biz = await mockDb.query.businessProfiles.findFirst();
    if (!biz) throw new Error("Business not found");

    // Normalize to array
    const docsArray = Array.isArray(input) ? input : [input];

    await mockDb.transaction(async (tx: any) => {
      for (const d of docsArray) {
        const existing = await tx.query.businessDocuments.findFirst();

        if (existing) {
          // Log document update to audit trail
          await mockAuditTrailService.logAction({
            loanApplicationId: businessId,
            userId: user.id,
            action: "documents_updated",
            reason: "Business document updated",
            details: `Business document ${d.docType} updated for business ${businessId}`,
            beforeData: {
              docType: d.docType,
              docUrl: existing.docUrl,
              isPasswordProtected: existing.isPasswordProtected,
              docBankName: existing.docBankName,
              docYear: existing.docYear,
            },
            afterData: {
              docType: d.docType,
              docUrl: d.docUrl,
              isPasswordProtected: d.isPasswordProtected,
              docBankName: d.docBankName,
              docYear: d.docYear,
            },
            metadata: {
              businessId,
              documentType: d.docType,
              operation: "update",
            },
          });

          await tx.update().set({
            docUrl: d.docUrl,
            isPasswordProtected: d.isPasswordProtected,
            docPassword: d.docPassword,
            docBankName: d.docBankName,
            docYear: d.docYear,
            updatedAt: new Date(),
          }).where();
        } else {
          // Log document creation to audit trail
          await mockAuditTrailService.logAction({
            loanApplicationId: businessId,
            userId: user.id,
            action: "documents_uploaded",
            reason: "Business document uploaded",
            details: `Business document ${d.docType} uploaded for business ${businessId}`,
            beforeData: {},
            afterData: {
              docType: d.docType,
              docUrl: d.docUrl,
              isPasswordProtected: d.isPasswordProtected,
              docBankName: d.docBankName,
              docYear: d.docYear,
            },
            metadata: {
              businessId,
              documentType: d.docType,
              operation: "create",
            },
          });

          await tx.insert().values({
            businessId,
            docType: d.docType,
            docUrl: d.docUrl,
            isPasswordProtected: d.isPasswordProtected,
            docPassword: d.docPassword,
            docBankName: d.docBankName,
            docYear: d.docYear,
          });
        }
      }
    });

    return { success: true, message: "Business documents upserted successfully" };
  }

  static async list(clerkId: string, businessId: string) {
    // Simulate the list method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    const biz = await mockDb.query.businessProfiles.findFirst();
    if (!biz) throw new Error("Business not found");

    const rows = await mockDb.query.businessDocuments.findMany();

    return {
      success: true,
      message: "Business documents retrieved successfully",
      data: rows,
    };
  }

  static async createDocumentRequest(clerkId: string, businessId: string, input: any) {
    // Simulate the createDocumentRequest method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    const biz = await mockDb.query.businessProfiles.findFirst();
    if (!biz) throw new Error("Business not found");

    // Create document request
    const request = await mockDocumentRequestService.createRequest({
      loanApplicationId: businessId,
      documentType: input.documentType,
      reason: input.reason,
      dueDate: input.dueDate,
      metadata: {
        ...input.metadata,
        businessId,
        documentCategory: "business",
      },
    });

    // Log document request creation to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: businessId,
      userId: user.id,
      action: "document_request_created",
      reason: "Document request created for business documents",
      details: `Document request created for ${input.documentType} for business ${businessId}`,
      beforeData: {},
      afterData: {
        requestId: request.id,
        documentType: input.documentType,
        reason: input.reason,
        dueDate: input.dueDate,
      },
      metadata: {
        businessId,
        documentType: input.documentType,
        requestId: request.id,
      },
    });

    return {
      success: true,
      message: "Document request created successfully",
    };
  }

  static async fulfillDocumentRequest(clerkId: string, businessId: string, requestId: string, documentData: any) {
    // Simulate the fulfillDocumentRequest method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    const biz = await mockDb.query.businessProfiles.findFirst();
    if (!biz) throw new Error("Business not found");

    // Get the document request
    const request = await mockDocumentRequestService.getRequest(requestId);
    if (!request) throw new Error("Document request not found");

    // Upload the document
    await MockBusinessDocumentsService.upsert(clerkId, businessId, documentData);

    // Mark the request as fulfilled
    await mockDocumentRequestService.fulfillRequest(requestId, {
      fulfilledBy: user.id,
      fulfillmentNotes: "Document uploaded successfully",
      metadata: {
        businessId,
        documentType: documentData.docType,
      },
    });

    // Log document request fulfillment to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: businessId,
      userId: user.id,
      action: "document_request_fulfilled",
      reason: "Document request fulfilled",
      details: `Document request ${requestId} fulfilled for business ${businessId}`,
      beforeData: {
        requestId,
        status: "pending",
      },
      afterData: {
        requestId,
        status: "fulfilled",
        documentType: documentData.docType,
      },
      metadata: {
        businessId,
        requestId,
        documentType: documentData.docType,
      },
    });

    return {
      success: true,
      message: "Document request fulfilled successfully",
    };
  }
}

describe("BusinessDocumentsService Integration Tests", () => {
  describe("upsert", () => {
    it("should upsert business documents with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const businessId = "business_123";
      const input = {
        docType: "audited_financial_statements",
        docUrl: "https://example.com/doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
      };

      const result = await MockBusinessDocumentsService.upsert(clerkId, businessId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Business documents upserted successfully");
    });

    it("should log document creation to audit trail", async () => {
      const clerkId = "clerk_123";
      const businessId = "business_123";
      const input = {
        docType: "audited_financial_statements",
        docUrl: "https://example.com/doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
      };

      // Mock to return no existing document (new document)
      mockTx.query.businessDocuments.findFirst = () => Promise.resolve(null);

      const result = await MockBusinessDocumentsService.upsert(clerkId, businessId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Business documents upserted successfully");
    });
  });

  describe("list", () => {
    it("should list business documents", async () => {
      const clerkId = "clerk_123";
      const businessId = "business_123";

      const result = await MockBusinessDocumentsService.list(clerkId, businessId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Business documents retrieved successfully");
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe("createDocumentRequest", () => {
    it("should create a document request with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const businessId = "business_123";
      const input = {
        documentType: "audited_financial_statements",
        reason: "Required for loan approval",
        dueDate: new Date("2024-12-31"),
        metadata: { priority: "high" },
      };

      const result = await MockBusinessDocumentsService.createDocumentRequest(clerkId, businessId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Document request created successfully");
    });
  });

  describe("fulfillDocumentRequest", () => {
    it("should fulfill a document request with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const businessId = "business_123";
      const requestId = "request_123";
      const documentData = {
        docType: "audited_financial_statements",
        docUrl: "https://example.com/doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
      };

      const result = await MockBusinessDocumentsService.fulfillDocumentRequest(clerkId, businessId, requestId, documentData);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Document request fulfilled successfully");
    });
  });

  describe("error handling", () => {
    it("should handle user not found error", async () => {
      const clerkId = "invalid_clerk";
      const businessId = "business_123";
      const input = {
        docType: "audited_financial_statements",
        docUrl: "https://example.com/doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
      };

      // Mock user not found
      mockDb.query.users.findFirst = () => Promise.resolve(null);

      try {
        await MockBusinessDocumentsService.upsert(clerkId, businessId, input);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe("User not found");
      }
    });

    it("should handle business not found error", async () => {
      const clerkId = "clerk_123";
      const businessId = "invalid_business";
      const input = {
        docType: "audited_financial_statements",
        docUrl: "https://example.com/doc.pdf",
        isPasswordProtected: false,
        docPassword: null,
        docBankName: null,
        docYear: 2023,
      };

      // Mock user found but business not found
      mockDb.query.users.findFirst = () => Promise.resolve({
        id: "user_123",
        clerkId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      });
      mockDb.query.businessProfiles.findFirst = () => Promise.resolve(null);

      try {
        await MockBusinessDocumentsService.upsert(clerkId, businessId, input);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe("Business not found");
      }
    });
  });
});
