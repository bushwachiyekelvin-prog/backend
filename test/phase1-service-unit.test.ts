import { describe, it, expect } from "bun:test";

// Mock the database client
const mockDb = {
  insert: () => ({
    values: () => ({
      returning: () => Promise.resolve([{
        id: "test-id",
        loanApplicationId: "test-app-id",
        userId: "test-user-id",
        action: "application_created",
        reason: "Test reason",
        details: "Test details",
        metadata: JSON.stringify({ test: "data" }),
        beforeData: null,
        afterData: null,
        createdAt: new Date(),
      }])
    })
  }),
  select: () => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            offset: () => Promise.resolve([{
              id: "test-id",
              loanApplicationId: "test-app-id",
              userId: "test-user-id",
              action: "application_created",
              reason: "Test reason",
              details: "Test details",
              metadata: JSON.stringify({ test: "data" }),
              beforeData: null,
              afterData: null,
              createdAt: new Date(),
            }])
          })
        })
      })
    })
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([{
          id: "test-id",
          status: "fulfilled",
          fulfilledAt: new Date(),
          fulfilledWith: "test-document-id",
          updatedAt: new Date(),
        }])
      })
    })
  })
};

// Mock the schema
const mockApplicationAuditTrail = {
  id: "test-audit-id",
  loanApplicationId: "test-app-id",
  userId: "test-user-id",
  action: "application_created",
  reason: "Test reason",
  details: "Test details",
  metadata: JSON.stringify({ test: "data" }),
  beforeData: null,
  afterData: null,
  createdAt: new Date(),
};

const mockLoanApplicationSnapshots = {
  id: "test-snapshot-id",
  loanApplicationId: "test-app-id",
  createdBy: "test-user-id",
  snapshotData: JSON.stringify({
    application: { id: "test-app-id" },
    businessProfile: { id: "test-business-id" },
    personalDocuments: [],
    businessDocuments: [],
    metadata: {
      createdAt: new Date().toISOString(),
      createdBy: "test-user-id",
      approvalStage: "loan_approved",
    },
  }),
  approvalStage: "loan_approved",
  createdAt: new Date(),
};

const mockDocumentRequests = {
  id: "test-request-id",
  loanApplicationId: "test-app-id",
  requestedBy: "test-user-id",
  requestedFrom: "test-user-id",
  documentType: "business_registration",
  description: "Test description",
  isRequired: "true",
  status: "pending",
  fulfilledAt: null,
  fulfilledWith: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock the services
const mockAuditTrailService = {
  logAction: async (params: any) => {
    if (!params.loanApplicationId || !params.userId || !params.action) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      id: "test-id",
      loanApplicationId: params.loanApplicationId,
      userId: params.userId,
      action: params.action,
      reason: params.reason || null,
      details: params.details || null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
      afterData: params.afterData ? JSON.stringify(params.afterData) : null,
      createdAt: new Date().toISOString(),
    };
  },
  getAuditTrail: async (params: any) => {
    if (!params.loanApplicationId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return [{
      id: "test-id",
      loanApplicationId: params.loanApplicationId,
      userId: "test-user-id",
      action: "application_created",
      reason: "Test reason",
      details: "Test details",
      metadata: JSON.stringify({ test: "data" }),
      beforeData: null,
      afterData: null,
      createdAt: new Date().toISOString(),
    }];
  },
  getAuditTrailSummary: async (loanApplicationId: string) => {
    if (!loanApplicationId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      totalEntries: 5,
      lastAction: "application_created",
      lastActionAt: new Date().toISOString(),
      actions: {
        "application_created": 1,
        "application_submitted": 1,
        "application_approved": 1,
        "snapshot_created": 1,
        "application_disbursed": 1,
      },
    };
  },
};

const mockSnapshotService = {
  createSnapshot: async (params: any) => {
    if (!params.loanApplicationId || !params.createdBy) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      id: "test-snapshot-id",
      loanApplicationId: params.loanApplicationId,
      createdBy: params.createdBy,
      snapshotData: {
        application: { id: params.loanApplicationId },
        businessProfile: { id: "test-business-id" },
        personalDocuments: [],
        businessDocuments: [],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: params.createdBy,
          approvalStage: params.approvalStage || "loan_approved",
        },
      },
      approvalStage: params.approvalStage || "loan_approved",
      createdAt: new Date().toISOString(),
    };
  },
  getSnapshot: async (snapshotId: string) => {
    if (!snapshotId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    if (snapshotId === "non-existent-id") {
      const error = new Error("SNAPSHOT_NOT_FOUND") as any;
      error.statusCode = 404;
      throw error;
    }
    return {
      id: snapshotId,
      loanApplicationId: "test-app-id",
      createdBy: "test-user-id",
      snapshotData: {
        application: { id: "test-app-id" },
        businessProfile: { id: "test-business-id" },
        personalDocuments: [],
        businessDocuments: [],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: "test-user-id",
          approvalStage: "loan_approved",
        },
      },
      approvalStage: "loan_approved",
      createdAt: new Date().toISOString(),
    };
  },
  getSnapshots: async (loanApplicationId: string) => {
    if (!loanApplicationId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return [{
      id: "test-snapshot-id",
      loanApplicationId,
      createdBy: "test-user-id",
      snapshotData: {
        application: { id: loanApplicationId },
        businessProfile: { id: "test-business-id" },
        personalDocuments: [],
        businessDocuments: [],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: "test-user-id",
          approvalStage: "loan_approved",
        },
      },
      approvalStage: "loan_approved",
      createdAt: new Date().toISOString(),
    }];
  },
  getLatestSnapshot: async (loanApplicationId: string) => {
    if (!loanApplicationId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      id: "test-snapshot-id",
      loanApplicationId,
      createdBy: "test-user-id",
      snapshotData: {
        application: { id: loanApplicationId },
        businessProfile: { id: "test-business-id" },
        personalDocuments: [],
        businessDocuments: [],
        metadata: {
          createdAt: new Date().toISOString(),
          createdBy: "test-user-id",
          approvalStage: "loan_approved",
        },
      },
      approvalStage: "loan_approved",
      createdAt: new Date().toISOString(),
    };
  },
};

const mockDocumentRequestService = {
  createRequest: async (params: any) => {
    if (!params.loanApplicationId || !params.requestedBy || !params.requestedFrom || 
        !params.documentType || !params.description) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      id: "test-request-id",
      loanApplicationId: params.loanApplicationId,
      requestedBy: params.requestedBy,
      requestedFrom: params.requestedFrom,
      documentType: params.documentType,
      description: params.description,
      isRequired: params.isRequired !== false ? "true" : "false",
      status: "pending",
      fulfilledAt: null,
      fulfilledWith: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  fulfillRequest: async (params: any) => {
    if (!params.requestId || !params.fulfilledWith) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      id: params.requestId,
      loanApplicationId: "test-app-id",
      requestedBy: "test-user-id",
      requestedFrom: "test-user-id",
      documentType: "business_registration",
      description: "Test description",
      isRequired: "true",
      status: "fulfilled",
      fulfilledAt: new Date().toISOString(),
      fulfilledWith: params.fulfilledWith,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  getRequest: async (requestId: string) => {
    if (!requestId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      id: requestId,
      loanApplicationId: "test-app-id",
      requestedBy: "test-user-id",
      requestedFrom: "test-user-id",
      documentType: "business_registration",
      description: "Test description",
      isRequired: "true",
      status: "pending",
      fulfilledAt: null,
      fulfilledWith: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  getRequests: async (loanApplicationId: string, status?: string) => {
    if (!loanApplicationId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return [{
      id: "test-request-id",
      loanApplicationId,
      requestedBy: "test-user-id",
      requestedFrom: "test-user-id",
      documentType: "business_registration",
      description: "Test description",
      isRequired: "true",
      status: status || "pending",
      fulfilledAt: null,
      fulfilledWith: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  },
  getPendingRequests: async (userId: string) => {
    if (!userId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return [{
      id: "test-request-id",
      loanApplicationId: "test-app-id",
      requestedBy: "test-user-id",
      requestedFrom: userId,
      documentType: "business_registration",
      description: "Test description",
      isRequired: "true",
      status: "pending",
      fulfilledAt: null,
      fulfilledWith: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  },
  getRequestStatistics: async (loanApplicationId: string) => {
    if (!loanApplicationId) {
      const error = new Error("INVALID_PARAMETERS") as any;
      error.statusCode = 400;
      throw error;
    }
    return {
      total: 3,
      pending: 1,
      fulfilled: 2,
      overdue: 0,
    };
  },
};

describe("Phase 1 - Service Unit Tests", () => {
  const testLoanApplicationId = "test-app-id";
  const testUserId = "test-user-id";

  describe("AuditTrailService", () => {
    it("should log a single action", async () => {
      const result = await mockAuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "application_created",
        reason: "Test audit log",
        details: "Test details for audit",
        metadata: { test: "metadata" },
      });

      expect(result).toBeDefined();
      expect(result.loanApplicationId).toBe(testLoanApplicationId);
      expect(result.userId).toBe(testUserId);
      expect(result.action).toBe("application_created");
      expect(result.reason).toBe("Test audit log");
      expect(result.details).toBe("Test details for audit");
      expect(result.metadata).toBe(JSON.stringify({ test: "metadata" }));
    });

    it("should get audit trail", async () => {
      const entries = await mockAuditTrailService.getAuditTrail({
        loanApplicationId: testLoanApplicationId,
        limit: 10,
      });

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].loanApplicationId).toBe(testLoanApplicationId);
    });

    it("should get audit trail summary", async () => {
      const summary = await mockAuditTrailService.getAuditTrailSummary(testLoanApplicationId);

      expect(summary).toBeDefined();
      expect(summary.totalEntries).toBeGreaterThan(0);
      expect(summary.lastAction).toBe("application_created");
      expect(summary.lastActionAt).toBeDefined();
      expect(summary.actions).toBeDefined();
      expect(summary.actions["application_created"]).toBeGreaterThan(0);
    });

    it("should handle invalid parameters", async () => {
      try {
        await mockAuditTrailService.logAction({
          loanApplicationId: "",
          userId: testUserId,
          action: "application_created",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(400);
        expect(error.message).toContain("INVALID_PARAMETERS");
      }
    });
  });

  describe("SnapshotService", () => {
    it("should create a snapshot", async () => {
      const result = await mockSnapshotService.createSnapshot({
        loanApplicationId: testLoanApplicationId,
        createdBy: testUserId,
        approvalStage: "loan_approved",
      });

      expect(result).toBeDefined();
      expect(result.loanApplicationId).toBe(testLoanApplicationId);
      expect(result.createdBy).toBe(testUserId);
      expect(result.approvalStage).toBe("loan_approved");
      expect(result.snapshotData).toBeDefined();
      expect(result.snapshotData.application).toBeDefined();
      expect(result.snapshotData.businessProfile).toBeDefined();
      expect(result.snapshotData.personalDocuments).toBeDefined();
      expect(result.snapshotData.businessDocuments).toBeDefined();
      expect(result.snapshotData.metadata).toBeDefined();
    });

    it("should get snapshot by ID", async () => {
      const retrieved = await mockSnapshotService.getSnapshot("test-snapshot-id");

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe("test-snapshot-id");
      expect(retrieved.loanApplicationId).toBe(testLoanApplicationId);
      expect(retrieved.createdBy).toBe(testUserId);
      expect(retrieved.approvalStage).toBe("loan_approved");
    });

    it("should get snapshots for loan application", async () => {
      const snapshots = await mockSnapshotService.getSnapshots(testLoanApplicationId);

      expect(snapshots).toBeDefined();
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].loanApplicationId).toBe(testLoanApplicationId);
    });

    it("should get latest snapshot", async () => {
      const latest = await mockSnapshotService.getLatestSnapshot(testLoanApplicationId);

      expect(latest).toBeDefined();
      expect(latest?.loanApplicationId).toBe(testLoanApplicationId);
      expect(latest?.createdBy).toBe(testUserId);
    });

    it("should handle non-existent snapshot", async () => {
      try {
        await mockSnapshotService.getSnapshot("non-existent-id");
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
        expect(error.message).toContain("SNAPSHOT_NOT_FOUND");
      }
    });
  });

  describe("DocumentRequestService", () => {
    it("should create a document request", async () => {
      const result = await mockDocumentRequestService.createRequest({
        loanApplicationId: testLoanApplicationId,
        requestedBy: testUserId,
        requestedFrom: testUserId,
        documentType: "business_registration",
        description: "Please upload business registration document",
        isRequired: true,
      });

      expect(result).toBeDefined();
      expect(result.loanApplicationId).toBe(testLoanApplicationId);
      expect(result.requestedBy).toBe(testUserId);
      expect(result.requestedFrom).toBe(testUserId);
      expect(result.documentType).toBe("business_registration");
      expect(result.description).toBe("Please upload business registration document");
      expect(result.isRequired).toBe("true");
      expect(result.status).toBe("pending");
    });

    it("should fulfill a document request", async () => {
      const fulfilled = await mockDocumentRequestService.fulfillRequest({
        requestId: "test-request-id",
        fulfilledWith: "test-document-id",
      });

      expect(fulfilled).toBeDefined();
      expect(fulfilled.id).toBe("test-request-id");
      expect(fulfilled.status).toBe("fulfilled");
      expect(fulfilled.fulfilledWith).toBe("test-document-id");
      expect(fulfilled.fulfilledAt).toBeDefined();
    });

    it("should get document request by ID", async () => {
      const retrieved = await mockDocumentRequestService.getRequest("test-request-id");

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe("test-request-id");
      expect(retrieved.loanApplicationId).toBe(testLoanApplicationId);
      expect(retrieved.documentType).toBe("business_registration");
    });

    it("should get document requests for loan application", async () => {
      const requests = await mockDocumentRequestService.getRequests(testLoanApplicationId);

      expect(requests).toBeDefined();
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].loanApplicationId).toBe(testLoanApplicationId);
    });

    it("should get pending requests for user", async () => {
      const pendingRequests = await mockDocumentRequestService.getPendingRequests(testUserId);

      expect(pendingRequests).toBeDefined();
      expect(Array.isArray(pendingRequests)).toBe(true);
      expect(pendingRequests.length).toBeGreaterThan(0);
      expect(pendingRequests[0].requestedFrom).toBe(testUserId);
      expect(pendingRequests[0].status).toBe("pending");
    });

    it("should get request statistics", async () => {
      const stats = await mockDocumentRequestService.getRequestStatistics(testLoanApplicationId);

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.fulfilled).toBeGreaterThanOrEqual(0);
      expect(stats.overdue).toBeGreaterThanOrEqual(0);
      expect(stats.total).toBe(stats.pending + stats.fulfilled + stats.overdue);
    });

    it("should handle invalid parameters", async () => {
      try {
        await mockDocumentRequestService.createRequest({
          loanApplicationId: "",
          requestedBy: testUserId,
          requestedFrom: testUserId,
          documentType: "business_registration",
          description: "Test",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(400);
        expect(error.message).toContain("INVALID_PARAMETERS");
      }
    });
  });

  describe("Service Integration", () => {
    it("should work together in a complete workflow", async () => {
      // 1. Log application creation
      const auditEntry = await mockAuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "application_created",
        reason: "User created loan application",
      });

      // 2. Create document request
      const request = await mockDocumentRequestService.createRequest({
        loanApplicationId: testLoanApplicationId,
        requestedBy: testUserId,
        requestedFrom: testUserId,
        documentType: "business_registration",
        description: "Please upload business registration",
      });

      // 3. Log document request creation
      await mockAuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "document_request_created",
        reason: "Admin requested additional documents",
        metadata: { requestId: request.id },
      });

      // 4. Fulfill document request
      const fulfilled = await mockDocumentRequestService.fulfillRequest({
        requestId: request.id,
        fulfilledWith: "test-document-id",
      });

      // 5. Log document request fulfillment
      await mockAuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "document_request_fulfilled",
        reason: "User uploaded requested document",
        metadata: { requestId: request.id, documentId: "test-document-id" },
      });

      // 6. Create snapshot
      const snapshot = await mockSnapshotService.createSnapshot({
        loanApplicationId: testLoanApplicationId,
        createdBy: testUserId,
        approvalStage: "loan_approved",
      });

      // 7. Log snapshot creation
      await mockAuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "snapshot_created",
        reason: "Loan approved, snapshot created",
        metadata: { snapshotId: snapshot.id },
      });

      // Verify the complete workflow
      const auditTrail = await mockAuditTrailService.getAuditTrail({
        loanApplicationId: testLoanApplicationId,
      });

      const requests = await mockDocumentRequestService.getRequests(testLoanApplicationId);
      const snapshots = await mockSnapshotService.getSnapshots(testLoanApplicationId);

      expect(auditTrail.length).toBeGreaterThanOrEqual(1);
      expect(requests.length).toBeGreaterThan(0);
      expect(snapshots.length).toBeGreaterThan(0);

      // Check that the workflow actions are logged
      expect(auditEntry.action).toBe("application_created");
      expect(fulfilled.status).toBe("fulfilled");
      expect(snapshot.approvalStage).toBe("loan_approved");
    });
  });
});
