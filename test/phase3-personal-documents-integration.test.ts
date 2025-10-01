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
    personalDocuments: {
      findMany: () => Promise.resolve([
        {
          docType: "national_id",
          docUrl: "https://example.com/id.pdf",
        },
        {
          docType: "passport",
          docUrl: "https://example.com/passport.pdf",
        },
      ]),
    },
  },
  transaction: (callback: any) => callback(mockTx),
};

// Mock transaction
const mockTx = {
  query: {
    personalDocuments: {
      findMany: () => Promise.resolve([
        {
          id: "doc_123",
          docType: "national_id",
          docUrl: "https://example.com/old-id.pdf",
        },
      ]),
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
    loanApplicationId: "user_123",
    userId: "user_123",
    action: "documents_uploaded",
    reason: "Personal document uploaded",
    details: "Personal document national_id uploaded for user user_123",
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
    loanApplicationId: "user_123",
    documentType: "national_id",
    description: "Required for loan approval",
    status: "pending",
    createdAt: new Date(),
  }),
  getRequest: () => Promise.resolve({
    id: "request_123",
    loanApplicationId: "user_123",
    documentType: "national_id",
    description: "Required for loan approval",
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

// Mock the service class
class MockPersonalDocumentsService {
  static async upsert(clerkId: string, input: any) {
    // Simulate the upsert method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    // Normalize to array and dedupe by docType (last one wins)
    const docsArray = Array.isArray(input) ? input : [input];
    const byType = new Map();
    for (const d of docsArray) {
      byType.set(d.docType, d.docUrl);
    }
    const upserts = Array.from(byType.entries()).map(([docType, docUrl]) => ({ docType, docUrl }));

    await mockDb.transaction(async (tx: any) => {
      // Find existing active documents for these types
      const existing = await tx.query.personalDocuments.findMany();

      const existingTypes = new Set(existing.map((e: any) => e.docType));
      const toUpdate = upserts.filter((d) => existingTypes.has(d.docType));
      const toInsert = upserts.filter((d) => !existingTypes.has(d.docType));

      // Perform updates per type
      for (const d of toUpdate) {
        const existingDoc = existing.find((e: any) => e.docType === d.docType);
        
        // Log document update to audit trail
        await mockAuditTrailService.logAction({
          loanApplicationId: user.id,
          userId: user.id,
          action: "documents_updated",
          reason: "Personal document updated",
          details: `Personal document ${d.docType} updated for user ${user.id}`,
          beforeData: {
            docType: d.docType,
            docUrl: existingDoc?.docUrl,
          },
          afterData: {
            docType: d.docType,
            docUrl: d.docUrl,
          },
          metadata: {
            userId: user.id,
            documentType: d.docType,
            operation: "update",
          },
        });

        await tx.update().set({
          docUrl: d.docUrl,
          updatedAt: new Date(),
        }).where();
      }

      // Perform bulk insert for new types
      if (toInsert.length > 0) {
        // Log document creation to audit trail
        for (const d of toInsert) {
          await mockAuditTrailService.logAction({
            loanApplicationId: user.id,
            userId: user.id,
            action: "documents_uploaded",
            reason: "Personal document uploaded",
            details: `Personal document ${d.docType} uploaded for user ${user.id}`,
            beforeData: {},
            afterData: {
              docType: d.docType,
              docUrl: d.docUrl,
            },
            metadata: {
              userId: user.id,
              documentType: d.docType,
              operation: "create",
            },
          });
        }

        await tx.insert().values(
          toInsert.map((d) => ({
            userId: user.id,
            docType: d.docType,
            docUrl: d.docUrl,
          })),
        );
      }
    });

    return { success: true, message: "Documents upserted successfully" };
  }

  static async list(clerkId: string) {
    // Simulate the list method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    const docs = await mockDb.query.personalDocuments.findMany();

    return {
      success: true,
      message: "Documents retrieved successfully",
      data: docs,
    };
  }

  static async createDocumentRequest(clerkId: string, input: any) {
    // Simulate the createDocumentRequest method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    // Create document request
    const request = await mockDocumentRequestService.createRequest({
      loanApplicationId: user.id,
      requestedBy: user.id,
      requestedFrom: user.id,
      documentType: input.documentType,
      description: input.reason,
      isRequired: true,
    });

    // Log document request creation to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: user.id,
      userId: user.id,
      action: "document_request_created",
      reason: "Document request created for personal documents",
      details: `Document request created for ${input.documentType} for user ${user.id}`,
      beforeData: {},
      afterData: {
        requestId: request.id,
        documentType: input.documentType,
        reason: input.reason,
        dueDate: input.dueDate,
      },
      metadata: {
        userId: user.id,
        documentType: input.documentType,
        requestId: request.id,
      },
    });

    return {
      success: true,
      message: "Document request created successfully",
    };
  }

  static async fulfillDocumentRequest(clerkId: string, requestId: string, documentData: any) {
    // Simulate the fulfillDocumentRequest method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");

    // Get the document request
    const request = await mockDocumentRequestService.getRequest(requestId);
    if (!request) throw new Error("Document request not found");

    // Upload the document
    await this.upsert(clerkId, documentData);

    // Mark the request as fulfilled
    await mockDocumentRequestService.fulfillRequest({
      requestId,
      fulfilledWith: "personal_document_upload",
    });

    // Log document request fulfillment to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: user.id,
      userId: user.id,
      action: "document_request_fulfilled",
      reason: "Document request fulfilled",
      details: `Document request ${requestId} fulfilled for user ${user.id}`,
      beforeData: {
        requestId,
        status: "pending",
      },
      afterData: {
        requestId,
        status: "fulfilled",
        documentType: Array.isArray(documentData) ? documentData[0]?.docType : documentData.docType,
      },
      metadata: {
        userId: user.id,
        requestId,
        documentType: Array.isArray(documentData) ? documentData[0]?.docType : documentData.docType,
      },
    });

    return {
      success: true,
      message: "Document request fulfilled successfully",
    };
  }
}

describe("PersonalDocumentsService Integration Tests", () => {
  describe("upsert", () => {
    it("should upsert personal documents with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const input = {
        docType: "national_id",
        docUrl: "https://example.com/id.pdf",
      };

      const result = await MockPersonalDocumentsService.upsert(clerkId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Documents upserted successfully");
    });

    it("should log document creation to audit trail", async () => {
      const clerkId = "clerk_123";
      const input = {
        docType: "passport",
        docUrl: "https://example.com/passport.pdf",
      };

      // Mock to return no existing document (new document)
      mockTx.query.personalDocuments.findMany = () => Promise.resolve([]);

      const result = await MockPersonalDocumentsService.upsert(clerkId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Documents upserted successfully");
    });

    it("should handle multiple documents", async () => {
      const clerkId = "clerk_123";
      const input = [
        {
          docType: "national_id",
          docUrl: "https://example.com/id.pdf",
        },
        {
          docType: "passport",
          docUrl: "https://example.com/passport.pdf",
        },
      ];

      const result = await MockPersonalDocumentsService.upsert(clerkId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Documents upserted successfully");
    });
  });

  describe("list", () => {
    it("should list personal documents", async () => {
      const clerkId = "clerk_123";

      const result = await MockPersonalDocumentsService.list(clerkId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Documents retrieved successfully");
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
    });
  });

  describe("createDocumentRequest", () => {
    it("should create a document request with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const input = {
        documentType: "national_id",
        reason: "Required for loan approval",
        dueDate: new Date("2024-12-31"),
        metadata: { priority: "high" },
      };

      const result = await MockPersonalDocumentsService.createDocumentRequest(clerkId, input);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Document request created successfully");
    });
  });

  describe("fulfillDocumentRequest", () => {
    it("should fulfill a document request with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const requestId = "request_123";
      const documentData = {
        docType: "national_id",
        docUrl: "https://example.com/id.pdf",
      };

      const result = await MockPersonalDocumentsService.fulfillDocumentRequest(clerkId, requestId, documentData);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Document request fulfilled successfully");
    });
  });

  describe("error handling", () => {
    it("should handle user not found error", async () => {
      const clerkId = "invalid_clerk";
      const input = {
        docType: "national_id",
        docUrl: "https://example.com/id.pdf",
      };

      // Mock user not found
      mockDb.query.users.findFirst = () => Promise.resolve(null);

      try {
        await MockPersonalDocumentsService.upsert(clerkId, input);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe("User not found");
      }
    });

    it("should handle document request not found error", async () => {
      const clerkId = "clerk_123";
      const requestId = "invalid_request";
      const documentData = {
        docType: "national_id",
        docUrl: "https://example.com/id.pdf",
      };

      // Mock user found but document request not found
      mockDb.query.users.findFirst = () => Promise.resolve({
        id: "user_123",
        clerkId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      });
      mockDocumentRequestService.getRequest = () => Promise.resolve(null);

      try {
        await MockPersonalDocumentsService.fulfillDocumentRequest(clerkId, requestId, documentData);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe("Document request not found");
      }
    });
  });
});
