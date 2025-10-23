import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db } from "../src/db/client";
import { 
  loanApplications, 
  applicationAuditTrail, 
  loanApplicationSnapshots, 
  documentRequests,
  users,
  businessProfiles 
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import { AuditTrailService } from "../src/modules/audit-trail/audit-trail.service";
import { SnapshotService } from "../src/modules/snapshots/snapshot.service";
import { DocumentRequestService } from "../src/modules/document-requests/document-request.service";

describe("Phase 1 - Service Integration Tests", () => {
  let testUserId: string;
  let testBusinessId: string;
  let testLoanApplicationId: string;

  beforeAll(async () => {
    // Create test user
    const [testUser] = await db
      .insert(users)
      .values({
        clerkId: "test_clerk_id_service",
        firstName: "Test",
        lastName: "User",
        email: "test-service@example.com",
        phoneNumber: "+1234567891",
        role: "user",
        position: "test",
        gender: "other",
        idNumber: "123456790",
        taxNumber: "987654322",
        dob: new Date("1990-01-01"),
        idType: "national_id",
      })
      .returning();

    testUserId = testUser.id;

    // Create test business profile
    const [testBusiness] = await db
      .insert(businessProfiles)
      .values({
        userId: testUserId,
        name: "Test Business Service",
        description: "Test business description for services",
        entityType: "LLC",
        country: "US",
        city: "Test City",
        address: "123 Test St",
        zipCode: "12345",
        sector: "Technology",
        yearOfIncorporation: "2020",
        avgMonthlyTurnover: "10000",
        avgYearlyTurnover: "120000",
        borrowingHistory: false,
        currency: "USD",
        ownershipType: "sole_proprietorship",
        ownershipPercentage: 100,
        isOwned: true,
      })
      .returning();

    testBusinessId = testBusiness.id;

    // Create test loan application
    const [testApplication] = await db
      .insert(loanApplications)
      .values({
        applicationNumber: "TEST-SERVICE-001",
        userId: testUserId,
        businessId: testBusinessId,
        loanProductId: "test-product-id",
        loanAmount: "50000",
        loanTerm: 12,
        currency: "USD",
        purpose: "working_capital",
        status: "submitted",
        isBusinessLoan: true,
        submittedAt: new Date(),
        statusReason: "Test service application",
        lastUpdatedBy: testUserId,
        lastUpdatedAt: new Date(),
      })
      .returning();

    testLoanApplicationId = testApplication.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(documentRequests).where(eq(documentRequests.loanApplicationId, testLoanApplicationId));
    await db.delete(loanApplicationSnapshots).where(eq(loanApplicationSnapshots.loanApplicationId, testLoanApplicationId));
    await db.delete(applicationAuditTrail).where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));
    await db.delete(loanApplications).where(eq(loanApplications.id, testLoanApplicationId));
    await db.delete(businessProfiles).where(eq(businessProfiles.id, testBusinessId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe("AuditTrailService", () => {
    it("should log a single action", async () => {
      const result = await AuditTrailService.logAction({
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
      const entries = await AuditTrailService.getAuditTrail({
        loanApplicationId: testLoanApplicationId,
        limit: 10,
      });

      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].loanApplicationId).toBe(testLoanApplicationId);
    });

    it("should get audit trail summary", async () => {
      const summary = await AuditTrailService.getAuditTrailSummary(testLoanApplicationId);

      expect(summary).toBeDefined();
      expect(summary.totalEntries).toBeGreaterThan(0);
      expect(summary.lastAction).toBe("application_created");
      expect(summary.lastActionAt).toBeDefined();
      expect(summary.actions).toBeDefined();
      expect(summary.actions.application_created).toBeGreaterThan(0);
    });

    it("should log multiple actions", async () => {
      const actions = [
        {
          loanApplicationId: testLoanApplicationId,
          userId: testUserId,
          action: "application_submitted" as const,
          reason: "User submitted application",
        },
        {
          loanApplicationId: testLoanApplicationId,
          userId: testUserId,
          action: "application_under_review" as const,
          reason: "Admin started review",
        },
      ];

      const results = await AuditTrailService.logMultipleActions(actions);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);
      expect(results[0].action).toBe("application_submitted");
      expect(results[1].action).toBe("application_under_review");
    });

    it("should handle invalid parameters", async () => {
      try {
        await AuditTrailService.logAction({
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
      const result = await SnapshotService.createSnapshot({
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
      // First create a snapshot
      const created = await SnapshotService.createSnapshot({
        loanApplicationId: testLoanApplicationId,
        createdBy: testUserId,
        approvalStage: "test_snapshot",
      });

      // Then retrieve it
      const retrieved = await SnapshotService.getSnapshot(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.loanApplicationId).toBe(testLoanApplicationId);
      expect(retrieved.createdBy).toBe(testUserId);
      expect(retrieved.approvalStage).toBe("test_snapshot");
    });

    it("should get snapshots for loan application", async () => {
      const snapshots = await SnapshotService.getSnapshots(testLoanApplicationId);

      expect(snapshots).toBeDefined();
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].loanApplicationId).toBe(testLoanApplicationId);
    });

    it("should get latest snapshot", async () => {
      const latest = await SnapshotService.getLatestSnapshot(testLoanApplicationId);

      expect(latest).toBeDefined();
      expect(latest?.loanApplicationId).toBe(testLoanApplicationId);
      expect(latest?.createdBy).toBe(testUserId);
    });

    it("should handle non-existent snapshot", async () => {
      try {
        await SnapshotService.getSnapshot("non-existent-id");
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
        expect(error.message).toContain("SNAPSHOT_NOT_FOUND");
      }
    });
  });

  describe("DocumentRequestService", () => {
    it("should create a document request", async () => {
      const result = await DocumentRequestService.createRequest({
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
      // First create a request
      const created = await DocumentRequestService.createRequest({
        loanApplicationId: testLoanApplicationId,
        requestedBy: testUserId,
        requestedFrom: testUserId,
        documentType: "audited_financial_statements",
        description: "Please upload audited financial statements",
      });

      // Then fulfill it
      const fulfilled = await DocumentRequestService.fulfillRequest({
        requestId: created.id,
        fulfilledWith: "test-document-id",
      });

      expect(fulfilled).toBeDefined();
      expect(fulfilled.id).toBe(created.id);
      expect(fulfilled.status).toBe("fulfilled");
      expect(fulfilled.fulfilledWith).toBe("test-document-id");
      expect(fulfilled.fulfilledAt).toBeDefined();
    });

    it("should get document request by ID", async () => {
      // First create a request
      const created = await DocumentRequestService.createRequest({
        loanApplicationId: testLoanApplicationId,
        requestedBy: testUserId,
        requestedFrom: testUserId,
        documentType: "business_plan",
        description: "Please upload business plan",
      });

      // Then retrieve it
      const retrieved = await DocumentRequestService.getRequest(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.loanApplicationId).toBe(testLoanApplicationId);
      expect(retrieved.documentType).toBe("business_plan");
    });

    it("should get document requests for loan application", async () => {
      const requests = await DocumentRequestService.getRequests(testLoanApplicationId);

      expect(requests).toBeDefined();
      expect(Array.isArray(requests)).toBe(true);
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].loanApplicationId).toBe(testLoanApplicationId);
    });

    it("should get pending requests for user", async () => {
      const pendingRequests = await DocumentRequestService.getPendingRequests(testUserId);

      expect(pendingRequests).toBeDefined();
      expect(Array.isArray(pendingRequests)).toBe(true);
      // Should include at least one pending request
      const hasPending = pendingRequests.some(req => req.status === "pending");
      expect(hasPending).toBe(true);
    });

    it("should get request statistics", async () => {
      const stats = await DocumentRequestService.getRequestStatistics(testLoanApplicationId);

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.pending).toBeGreaterThanOrEqual(0);
      expect(stats.fulfilled).toBeGreaterThanOrEqual(0);
      expect(stats.overdue).toBeGreaterThanOrEqual(0);
      expect(stats.total).toBe(stats.pending + stats.fulfilled + stats.overdue);
    });

    it("should handle invalid parameters", async () => {
      try {
        await DocumentRequestService.createRequest({
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
      await AuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "application_created",
        reason: "User created loan application",
      });

      // 2. Create document request
      const request = await DocumentRequestService.createRequest({
        loanApplicationId: testLoanApplicationId,
        requestedBy: testUserId,
        requestedFrom: testUserId,
        documentType: "business_registration",
        description: "Please upload business registration",
      });

      // 3. Log document request creation
      await AuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "document_request_created",
        reason: "Admin requested additional documents",
        metadata: { requestId: request.id },
      });

      // 4. Fulfill document request
      await DocumentRequestService.fulfillRequest({
        requestId: request.id,
        fulfilledWith: "test-document-id",
      });

      // 5. Log document request fulfillment
      await AuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "document_request_fulfilled",
        reason: "User uploaded requested document",
        metadata: { requestId: request.id, documentId: "test-document-id" },
      });

      // 6. Create snapshot
      const snapshot = await SnapshotService.createSnapshot({
        loanApplicationId: testLoanApplicationId,
        createdBy: testUserId,
        approvalStage: "loan_approved",
      });

      // 7. Log snapshot creation
      await AuditTrailService.logAction({
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "snapshot_created",
        reason: "Loan approved, snapshot created",
        metadata: { snapshotId: snapshot.id },
      });

      // Verify the complete workflow
      const auditTrail = await AuditTrailService.getAuditTrail({
        loanApplicationId: testLoanApplicationId,
      });

      const requests = await DocumentRequestService.getRequests(testLoanApplicationId);
      const snapshots = await SnapshotService.getSnapshots(testLoanApplicationId);

      expect(auditTrail.length).toBeGreaterThanOrEqual(5);
      expect(requests.length).toBeGreaterThan(0);
      expect(snapshots.length).toBeGreaterThan(0);

      // Check that the workflow actions are logged
      const actions = auditTrail.map(entry => entry.action);
      expect(actions).toContain("application_created");
      expect(actions).toContain("document_request_created");
      expect(actions).toContain("document_request_fulfilled");
      expect(actions).toContain("snapshot_created");
    });
  });
});
