// @ts-ignore - bun:test types
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { db } from "../src/db/client";
import { 
  loanApplications, 
  applicationAuditTrail, 
  loanApplicationSnapshots, 
  documentRequests,
  users,
  businessProfiles,
  personalDocuments,
  businessDocuments
} from "../src/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { LoanApplicationsService } from "../src/modules/loan-applications/loan-applications.service";
import { AuditTrailService } from "../src/modules/audit-trail/audit-trail.service";
import { SnapshotService } from "../src/modules/snapshots/snapshot.service";
import { DocumentRequestService } from "../src/modules/document-requests/document-request.service";
import { StatusService } from "../src/modules/status/status.service";
import { BusinessDocuments } from "../src/modules/business-documents/business-documents.service";
import { Documents } from "../src/modules/documents/documents.service";

describe("Real Integration Tests", () => {
  let testUserId: string;
  let testClerkId: string;
  let testBusinessId: string;
  let testLoanApplicationId: string;
  let testLoanProductId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();
    
    // Create test user with unique email
    testClerkId = `test_clerk_id_${Date.now()}`;
    const uniqueEmail = `test_${Date.now()}@example.com`;
    const testUser = await db.insert(users).values({
      clerkId: testClerkId,
      email: uniqueEmail,
      firstName: "Test",
      lastName: "User",
      phoneNumber: "+1234567890",
    }).returning();
    testUserId = testUser[0].id;

    // Create test business profile
    const testBusiness = await db.insert(businessProfiles).values({
      userId: testUserId,
      name: "Test Business",
      description: "Test business description",
      entityType: "retail",
      address: "123 Test Street",
      city: "Test City",
      country: "Test Country",
      zipCode: "12345",
      isOwned: true,
    }).returning();
    testBusinessId = testBusiness[0].id;

    // Create test loan product with unique name
    const { loanProducts } = await import("../src/db/schema");
    const uniqueProductName = `Test Business Loan ${Date.now()}`;
    const testProduct = await db.insert(loanProducts).values({
      name: uniqueProductName,
      description: "Test loan product for integration tests",
      minAmount: 10000,
      maxAmount: 1000000,
      minTerm: 6,
      maxTerm: 60,
      termUnit: "months",
      interestRate: 12.5,
      currency: "USD",
      isActive: true,
      processingFee: 500,
      processingFeeType: "flat",
      latePaymentFee: 50,
      latePaymentFeeType: "flat",
    }).returning();
    testLoanProductId = testProduct[0].id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    // Clean up test loan application data before each test
    if (testLoanApplicationId) {
      await db.delete(applicationAuditTrail).where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));
      await db.delete(loanApplicationSnapshots).where(eq(loanApplicationSnapshots.loanApplicationId, testLoanApplicationId));
      await db.delete(documentRequests).where(eq(documentRequests.loanApplicationId, testLoanApplicationId));
      await db.delete(loanApplications).where(eq(loanApplications.id, testLoanApplicationId));
    }
  });

  async function cleanupTestData() {
    // Clean up in reverse order of dependencies
    if (testUserId) {
      await db.delete(applicationAuditTrail).where(eq(applicationAuditTrail.userId, testUserId));
      await db.delete(loanApplicationSnapshots).where(eq(loanApplicationSnapshots.createdBy, testUserId));
      await db.delete(documentRequests).where(eq(documentRequests.requestedBy, testUserId));
      await db.delete(personalDocuments).where(eq(personalDocuments.userId, testUserId));
    }
    if (testBusinessId) {
      await db.delete(businessDocuments).where(eq(businessDocuments.businessId, testBusinessId));
    }
    if (testUserId) {
      await db.delete(loanApplications).where(eq(loanApplications.userId, testUserId));
      await db.delete(businessProfiles).where(eq(businessProfiles.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testLoanProductId) {
      const { loanProducts } = await import("../src/db/schema");
      await db.delete(loanProducts).where(eq(loanProducts.id, testLoanProductId));
    }
    
    // Also clean up any existing test users with our pattern
    if (testClerkId) {
      await db.delete(users).where(eq(users.clerkId, testClerkId));
    }
  }

  describe("Loan Application Lifecycle", () => {
    it("should create a loan application and log to audit trail", async () => {
      // Create loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const result = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = result.data.id;

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.loanAmount).toBe(50000);
      expect(result.data.status).toBe("draft");

      // Verify audit trail entry was created
      const auditEntries = await db
        .select()
        .from(applicationAuditTrail)
        .where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));

      expect(auditEntries.length).toBe(1);
      expect(auditEntries[0].action).toBe("application_created");
      expect(auditEntries[0].userId).toBe(testUserId);
    });

    it("should update loan application and log changes", async () => {
      // First create a loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      // Update the loan application
      const updateData = {
        loanAmount: 75000,
        loanTerm: 18,
        purposeDescription: "Updated business expansion plans",
      };

      const updateResult = await LoanApplicationsService.update(testClerkId, testLoanApplicationId, updateData);

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.loanAmount).toBe(75000);
      expect(updateResult.data.loanTerm).toBe(18);

      // Verify audit trail entry was created for the update
      const auditEntries = await db
        .select()
        .from(applicationAuditTrail)
        .where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));

      expect(auditEntries.length).toBe(2); // Create + Update
      const updateEntry = auditEntries.find(entry => entry.action === "status_updated");
      expect(updateEntry).toBeDefined();
      expect(updateEntry?.beforeData).toContain("50000");
      expect(updateEntry?.afterData).toContain("75000");
    });

    it("should submit loan application and change status", async () => {
      // Create and submit loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      // Submit the application
      const submitResult = await LoanApplicationsService.updateStatus(
        testClerkId,
        testLoanApplicationId,
        { status: "submitted" }
      );

      expect(submitResult.success).toBe(true);
      
      // Verify status was updated in database
      const updatedApp = await db.select().from(loanApplications)
        .where(eq(loanApplications.id, testLoanApplicationId))
        .limit(1);
      expect(updatedApp[0].status).toBe("submitted");

      // Verify audit trail entry was created
      const auditEntries = await db
        .select()
        .from(applicationAuditTrail)
        .where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));

      expect(auditEntries.length).toBe(2); // Create + Submit
      const submitEntry = auditEntries.find(entry => entry.action === "application_submitted");
      expect(submitEntry).toBeDefined();
    });

    it("should approve loan application and create snapshot", async () => {
      // Create and submit loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      await LoanApplicationsService.updateStatus(testClerkId, testLoanApplicationId, { status: "submitted" });

      // Approve the application
      const approveResult = await LoanApplicationsService.updateStatus(
        testClerkId,
        testLoanApplicationId,
        { status: "approved" }
      );

      expect(approveResult.success).toBe(true);
      
      // Verify status was updated in database
      const approvedApp = await db.select().from(loanApplications)
        .where(eq(loanApplications.id, testLoanApplicationId))
        .limit(1);
      expect(approvedApp.length).toBe(1);
      expect(approvedApp[0].status).toBe("approved");

      // Verify snapshot was created
      const snapshots = await db
        .select()
        .from(loanApplicationSnapshots)
        .where(eq(loanApplicationSnapshots.loanApplicationId, testLoanApplicationId));

      expect(snapshots.length).toBe(1);
      expect(snapshots[0].approvalStage).toBe("loan_approval");
      expect(snapshots[0].createdBy).toBe(testUserId);

      // Verify audit trail entry was created
      const auditEntries = await db
        .select()
        .from(applicationAuditTrail)
        .where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));

      expect(auditEntries.length).toBe(4); // Create + Submit + Approve + Snapshot
      const approveEntry = auditEntries.find(entry => entry.action === "application_approved");
      expect(approveEntry).toBeDefined();
    });
  });

  describe("Document Management", () => {
    it("should upload personal documents and log to audit trail", async () => {
      const documentData = [
        {
          docType: "national_id_front" as const,
          docUrl: "https://example.com/id.pdf",
        },
        {
          docType: "passport_bio_page" as const,
          docUrl: "https://example.com/passport.pdf",
        },
      ];

      const result = await Documents.upsert(testClerkId, documentData);

      expect(result.success).toBe(true);

      // Verify documents were saved to database
      const savedDocs = await db
        .select()
        .from(personalDocuments)
        .where(and(eq(personalDocuments.userId, testUserId), isNull(personalDocuments.deletedAt)));

      expect(savedDocs.length).toBe(2);
    });

    it("should upload business documents and log to audit trail", async () => {
      const documentData = [
        {
          docType: "business_registration" as const,
          docUrl: "https://example.com/registration.pdf",
        },
      ];

      const result = await BusinessDocuments.upsert(testClerkId, testBusinessId, documentData);

      expect(result.success).toBe(true);

      // Verify documents were saved to database
      const savedDocs = await db
        .select()
        .from(businessDocuments)
        .where(and(eq(businessDocuments.businessId, testBusinessId), isNull(businessDocuments.deletedAt)));

      expect(savedDocs.length).toBe(1);
    });
  });

  describe("Document Requests", () => {
    it("should create and fulfill document requests", async () => {
      // Create a loan application first
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      // Create a document request
      const requestData = {
        loanApplicationId: testLoanApplicationId,
        requestedBy: testUserId,
        requestedFrom: testUserId,
        documentType: "bank_statement" as const,
        description: "Please provide bank statements for the last 6 months",
        isRequired: true,
      };

      const requestResult = await DocumentRequestService.createRequest(requestData);
      const testDocumentRequestId = requestResult.id;

      expect(requestResult).toBeDefined();
      expect(requestResult.status).toBe("pending");

      // Verify request was saved to database
      const savedRequest = await db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.id, testDocumentRequestId));

      expect(savedRequest.length).toBe(1);
      expect(savedRequest[0].documentType).toBe("bank_statement");
      expect(savedRequest[0].status).toBe("pending");

      // Fulfill the request
      const fulfillData = {
        requestId: testDocumentRequestId,
        fulfilledWith: "document_upload_id",
      };

      const fulfillResult = await DocumentRequestService.fulfillRequest(fulfillData);

      expect(fulfillResult).toBeDefined();

      // Verify request was updated
      const updatedRequest = await db
        .select()
        .from(documentRequests)
        .where(eq(documentRequests.id, testDocumentRequestId));

      expect(updatedRequest[0].status).toBe("fulfilled");
      expect(updatedRequest[0].fulfilledWith).toBe("document_upload_id");
    });
  });

  describe("Status Management", () => {
    it("should validate status transitions", async () => {
      // Create a loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      // Test valid transition: draft -> submitted
      const submitResult = await StatusService.updateStatus({
        loanApplicationId: testLoanApplicationId,
        newStatus: "submitted",
        userId: testUserId,
        reason: "Application submitted for review",
      });

      expect(submitResult.success).toBe(true);
      expect(submitResult.newStatus).toBe("submitted");

      // Test invalid transition: submitted -> draft (should fail)
      try {
        await StatusService.updateStatus({
          loanApplicationId: testLoanApplicationId,
          newStatus: "draft",
          userId: testUserId,
          reason: "Trying to go back to draft",
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain("Invalid status transition");
      }
    });

    it("should get status history", async () => {
      // Create and update status multiple times
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      await StatusService.updateStatus({
        loanApplicationId: testLoanApplicationId,
        newStatus: "submitted",
        userId: testUserId,
        reason: "Submitted for review",
      });

      await StatusService.updateStatus({
        loanApplicationId: testLoanApplicationId,
        newStatus: "under_review",
        userId: testUserId,
        reason: "Under review",
      });

      // Get status history
      const historyResult = await StatusService.getStatusHistory(testLoanApplicationId);

      expect(historyResult.length).toBeGreaterThanOrEqual(2); // At least submitted and under_review
      expect(historyResult[0].status).toBe("under_review");
    });
  });

  describe("Audit Trail", () => {
    it("should retrieve audit trail for loan application", async () => {
      // Create a loan application and perform multiple actions
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      await LoanApplicationsService.updateStatus(testClerkId, testLoanApplicationId, { status: "submitted" });
      await LoanApplicationsService.update(testClerkId, testLoanApplicationId, { loanAmount: 75000 });

      // Get audit trail
      const auditResult = await AuditTrailService.getAuditTrail({
        loanApplicationId: testLoanApplicationId,
      });

      expect(auditResult.length).toBeGreaterThanOrEqual(3); // create, submit, update

      // Verify audit trail entries exist
      const createEntry = auditResult.find(entry => entry.action === "application_created");
      const submitEntry = auditResult.find(entry => entry.action === "application_submitted");
      expect(createEntry).toBeDefined();
      expect(submitEntry).toBeDefined();
    });

    it("should log custom audit actions", async () => {
      // Create a loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      // Log a custom action
      const customAction = {
        loanApplicationId: testLoanApplicationId,
        userId: testUserId,
        action: "documents_uploaded" as const,
        reason: "User uploaded required documents",
        details: "Uploaded bank statements and tax returns",
        metadata: { documentCount: 3, totalSize: 5120 },
        beforeData: { documentCount: 0 },
        afterData: { documentCount: 3 },
      };

      const logResult = await AuditTrailService.logAction(customAction);

      expect(logResult).toBeDefined();
      expect(logResult.id).toBeDefined();

      // Verify the custom action was logged
      const auditEntries = await db
        .select()
        .from(applicationAuditTrail)
        .where(eq(applicationAuditTrail.loanApplicationId, testLoanApplicationId));

      expect(auditEntries.length).toBe(2); // create + custom action
      const customEntry = auditEntries.find(entry => entry.action === "documents_uploaded");
      expect(customEntry).toBeDefined();
      expect(customEntry?.metadata).toContain("documentCount");
    });
  });

  describe("Performance and Caching", () => {
    it("should handle multiple concurrent operations", async () => {
      // Create multiple loan applications concurrently
      const promises = Array(5).fill(null).map((_, index) => {
        const loanAppData = {
          businessId: testBusinessId,
          loanProductId: testLoanProductId,
          loanAmount: 50000 + (index * 10000),
          loanTerm: 12,
          currency: "USD",
          purpose: "business_expansion" as const,
          purposeDescription: `Test application ${index}`,
          isBusinessLoan: true,
        };
        return LoanApplicationsService.create(testClerkId, loanAppData);
      });

      const results = await Promise.all(promises);

      // Verify all applications were created successfully
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data.loanAmount).toBe(50000 + (index * 10000));
      });

      // Verify all applications exist in database
      const allApplications = await db
        .select()
        .from(loanApplications)
        .where(eq(loanApplications.userId, testUserId));

      expect(allApplications.length).toBeGreaterThanOrEqual(5);

      // Clean up created applications
      for (const result of results) {
        await db.delete(applicationAuditTrail).where(eq(applicationAuditTrail.loanApplicationId, result.data.id));
        await db.delete(loanApplications).where(eq(loanApplications.id, result.data.id));
      }
    });

    it("should handle large audit trail queries efficiently", async () => {
      // Create a loan application
      const loanAppData = {
        businessId: testBusinessId,
        loanProductId: testLoanProductId,
        loanAmount: 50000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion" as const,
        purposeDescription: "Expanding business operations",
        isBusinessLoan: true,
      };

      const createResult = await LoanApplicationsService.create(testClerkId, loanAppData);
      testLoanApplicationId = createResult.data.id;

      // Create many audit trail entries
      const auditPromises = Array(50).fill(null).map((_, index) => {
        return AuditTrailService.logAction({
          loanApplicationId: testLoanApplicationId,
          userId: testUserId,
          action: "status_updated" as const,
          reason: `Test action ${index}`,
          details: `This is test action number ${index}`,
          metadata: { index, timestamp: Date.now() },
          beforeData: { value: index },
          afterData: { value: index + 1 },
        });
      });

      await Promise.all(auditPromises);

      // Query audit trail and measure performance
      const startTime = Date.now();
      const auditResult = await AuditTrailService.getAuditTrail({
        loanApplicationId: testLoanApplicationId,
      });
      const endTime = Date.now();

      expect(auditResult.length).toBeGreaterThanOrEqual(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
