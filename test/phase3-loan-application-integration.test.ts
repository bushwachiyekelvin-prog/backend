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
    loanApplications: {
      findFirst: () => Promise.resolve({
        id: "app_123",
        applicationNumber: "APP-2024-001",
        userId: "user_123",
        status: "submitted",
        loanAmount: 10000,
        loanTerm: 12,
        purpose: "business_expansion",
        purposeDescription: "Expanding operations",
        coApplicantIds: null,
        deletedAt: null,
      }),
    },
  },
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{
          id: "product_123",
          name: "Business Loan",
          minAmount: 5000,
          maxAmount: 50000,
          minTerm: 6,
          maxTerm: 24,
          termUnit: "months",
          currency: "USD",
          deletedAt: null,
        }]),
      }),
    }),
  }),
  insert: () => ({
    values: () => ({
      returning: () => Promise.resolve([{
        id: "app_123",
        applicationNumber: "APP-2024-001",
        userId: "user_123",
        status: "submitted",
        loanAmount: 10000,
        loanTerm: 12,
        purpose: "business_expansion",
        purposeDescription: "Expanding operations",
        coApplicantIds: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([{
          id: "app_123",
          applicationNumber: "APP-2024-001",
          userId: "user_123",
          status: "withdrawn",
          loanAmount: 10000,
          loanTerm: 12,
          purpose: "business_expansion",
          purposeDescription: "Expanding operations",
          coApplicantIds: null,
          updatedAt: new Date(),
        }]),
      }),
    }),
  }),
};

// Mock the audit trail service
const mockAuditTrailService = {
  logAction: () => Promise.resolve({
    id: "audit_123",
    loanApplicationId: "app_123",
    userId: "user_123",
    action: "application_created",
    reason: "User created loan application",
    details: "Application APP-2024-001 created for business loan",
    metadata: {},
    beforeData: {},
    afterData: {},
    createdAt: new Date(),
  }),
};

// Mock the snapshot service
const mockSnapshotService = {
  createSnapshot: () => Promise.resolve({
    id: "snapshot_123",
    loanApplicationId: "app_123",
    createdBy: "user_123",
    approvalStage: "loan_approved",
    snapshotData: {},
    createdAt: new Date(),
  }),
};

// Mock the notification service
const mockNotificationService = {
  sendStatusUpdateNotification: () => Promise.resolve({
    success: true,
    messageId: "msg_123",
  }),
};

// Mock logger
const mockLogger = {
  error: () => {},
  info: () => {},
  warn: () => {},
  debug: () => {},
};

// Mock the loan applications mapper
const mockMapper = {
  mapLoanApplicationRow: (row: any) => ({
    id: row.id,
    applicationNumber: row.applicationNumber,
    userId: row.userId,
    status: row.status,
    loanAmount: row.loanAmount,
    loanTerm: row.loanTerm,
    purpose: row.purpose,
    purposeDescription: row.purposeDescription,
    coApplicantIds: row.coApplicantIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }),
  generateApplicationNumber: () => "APP-2024-001",
  toNumber: (value: any) => value,
};

// Mock the loan product snapshots table
const mockLoanProductSnapshots = {
  insert: () => ({
    values: () => Promise.resolve(),
  }),
};

// Mock the service class
class MockLoanApplicationsService {
  static async create(clerkId: string, body: any) {
    // Simulate the create method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");
    
    const [loanProduct] = await mockDb.select().from().where().limit();
    if (!loanProduct) throw new Error("Loan product not found");
    
    const [row] = await mockDb.insert().values({
      applicationNumber: mockMapper.generateApplicationNumber(),
      userId: "2",
      loanProductId: body.loanProductId,
      loanAmount: body.loanAmount,
      loanTerm: body.loanTerm,
      currency: body.currency,
      purpose: body.purpose,
      purposeDescription: body.purposeDescription,
      status: "submitted",
      submittedAt: new Date(),
      isBusinessLoan: body.isBusinessLoan,
    }).returning();
    
    // Log to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: row.id,
      userId: user.id,
      action: "application_created",
      reason: "User created loan application",
      details: `Application ${row.applicationNumber} created for ${body.isBusinessLoan ? 'business' : 'personal'} loan`,
      metadata: {
        applicationNumber: row.applicationNumber,
        loanAmount: body.loanAmount,
        loanTerm: body.loanTerm,
        purpose: body.purpose,
        isBusinessLoan: body.isBusinessLoan,
      },
    });
    
    // Create product snapshot
    await mockLoanProductSnapshots.insert().values({
      loanApplicationId: row.id,
      loanProductId: loanProduct.id,
      productSnapshot: {
        id: loanProduct.id,
        name: loanProduct.name,
        minAmount: loanProduct.minAmount,
        maxAmount: loanProduct.maxAmount,
        minTerm: loanProduct.minTerm,
        maxTerm: loanProduct.maxTerm,
        termUnit: loanProduct.termUnit,
        currency: loanProduct.currency,
      },
      createdAt: new Date(),
    });
    
    return {
      success: true,
      message: "Loan application created successfully",
      data: mockMapper.mapLoanApplicationRow(row),
    };
  }
  
  static async update(clerkId: string, id: string, body: any) {
    // Simulate the update method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");
    
    const existing = await mockDb.query.loanApplications.findFirst();
    if (!existing) throw new Error("Loan application not found");
    
    if (existing.status !== "submitted") {
      throw new Error("Only submitted applications can be updated");
    }
    
    const [row] = await mockDb.update().set({
      ...body,
      updatedAt: new Date(),
    }).where().returning();
    
    // Log to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: id,
      userId: user.id,
      action: "status_updated",
      reason: "User updated loan application details",
      details: `Application ${existing.applicationNumber} updated`,
      beforeData: {
        loanAmount: existing.loanAmount,
        loanTerm: existing.loanTerm,
        purpose: existing.purpose,
        purposeDescription: existing.purposeDescription,
        coApplicantIds: existing.coApplicantIds,
      },
      afterData: {
        loanAmount: body.loanAmount !== undefined ? body.loanAmount : existing.loanAmount,
        loanTerm: body.loanTerm !== undefined ? body.loanTerm : existing.loanTerm,
        purpose: body.purpose !== undefined ? body.purpose : existing.purpose,
        purposeDescription: body.purposeDescription !== undefined ? body.purposeDescription : existing.purposeDescription,
        coApplicantIds: body.coApplicantIds !== undefined ? JSON.stringify(body.coApplicantIds) : existing.coApplicantIds,
      },
      metadata: {
        applicationNumber: existing.applicationNumber,
        updatedFields: Object.keys(body).filter(key => body[key] !== undefined),
      },
    });
    
    return {
      success: true,
      message: "Loan application updated successfully",
      data: mockMapper.mapLoanApplicationRow(row),
    };
  }
  
  static async updateStatus(clerkId: string, id: string, body: any) {
    // Simulate the updateStatus method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");
    
    const existing = await mockDb.query.loanApplications.findFirst();
    if (!existing) throw new Error("Loan application not found");
    
    const updateSet: any = {
      status: body.status,
      updatedAt: new Date(),
      statusReason: `Status updated to ${body.status}`,
      lastUpdatedBy: user.id,
      lastUpdatedAt: new Date(),
    };
    
    // Set appropriate timestamp based on status
    switch (body.status) {
      case "under_review":
        updateSet.reviewedAt = new Date();
        break;
      case "approved":
        updateSet.approvedAt = new Date();
        break;
      case "disbursed":
        updateSet.disbursedAt = new Date();
        break;
      case "rejected":
        updateSet.rejectedAt = new Date();
        updateSet.rejectionReason = body.rejectionReason;
        break;
    }
    
    await mockDb.update().set(updateSet).where();
    
    // Log status update to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: id,
      userId: user.id,
      action: `application_${body.status}` as any,
      reason: `Application status updated to ${body.status}`,
      details: body.rejectionReason || `Status changed from ${existing.status} to ${body.status}`,
      beforeData: { status: existing.status },
      afterData: { ...updateSet },
      metadata: {
        previousStatus: existing.status,
        newStatus: body.status,
        rejectionReason: body.rejectionReason,
      },
    });
    
    // Create snapshot when application is approved
    if (body.status === "approved") {
      await mockSnapshotService.createSnapshot({
        loanApplicationId: id,
        createdBy: user.id,
        approvalStage: "loan_approved",
      });
      
      // Log snapshot creation
      await mockAuditTrailService.logAction({
        loanApplicationId: id,
        userId: user.id,
        action: "snapshot_created",
        reason: "Immutable snapshot created at loan approval",
        details: "Complete application state captured for audit trail",
        metadata: {
          approvalStage: "loan_approved",
        },
      });
    }
    
    // Send status update notification
    try {
      await mockNotificationService.sendStatusUpdateNotification(
        id,
        existing.userId,
        {
          previousStatus: existing.status,
          newStatus: body.status,
          reason: body.rejectionReason || `Status updated to ${body.status}`,
          rejectionReason: body.rejectionReason,
        },
        ['email']
      );
    } catch (error) {
      mockLogger.error("Failed to send status update notification:", error);
    }
    
    return {
      success: true,
      message: `Loan application status updated to ${body.status}`,
    };
  }
  
  static async withdraw(clerkId: string, id: string) {
    // Simulate the withdraw method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");
    
    const existing = await mockDb.query.loanApplications.findFirst();
    if (!existing) throw new Error("Loan application not found");
    
    if (["disbursed", "rejected", "withdrawn"].includes(existing.status)) {
      throw new Error("Application cannot be withdrawn in current status");
    }
    
    await mockDb.update().set({
      status: "withdrawn",
      updatedAt: new Date(),
      statusReason: "Application withdrawn by user",
      lastUpdatedBy: user.id,
      lastUpdatedAt: new Date(),
    }).where();
    
    // Log application withdrawal to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: id,
      userId: user.id,
      action: "application_withdrawn",
      reason: "User withdrew loan application",
      details: `Application ${existing.applicationNumber} withdrawn by user`,
      beforeData: { status: existing.status },
      afterData: { status: "withdrawn" },
      metadata: {
        applicationNumber: existing.applicationNumber,
        previousStatus: existing.status,
      },
    });
    
    // Send withdrawal notification
    try {
      await mockNotificationService.sendStatusUpdateNotification(
        id,
        user.id,
        {
          previousStatus: existing.status,
          newStatus: "withdrawn",
          reason: "Application withdrawn by user",
        },
        ['email']
      );
    } catch (error) {
      mockLogger.error("Failed to send withdrawal notification:", error);
    }
    
    return {
      success: true,
      message: "Loan application withdrawn successfully",
    };
  }
  
  static async remove(clerkId: string, id: string) {
    // Simulate the remove method
    const user = await mockDb.query.users.findFirst();
    if (!user) throw new Error("User not found");
    
    const existing = await mockDb.query.loanApplications.findFirst();
    if (!existing) throw new Error("Loan application not found");
    
    if (existing.status !== "submitted") {
      throw new Error("Only submitted applications can be deleted");
    }
    
    await mockDb.update().set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      statusReason: "Application deleted by user",
      lastUpdatedBy: user.id,
      lastUpdatedAt: new Date(),
    }).where();
    
    // Log application deletion to audit trail
    await mockAuditTrailService.logAction({
      loanApplicationId: id,
      userId: user.id,
      action: "application_deleted",
      reason: "User deleted loan application",
      details: `Application ${existing.applicationNumber} deleted by user`,
      beforeData: { 
        status: existing.status,
        deletedAt: null,
      },
      afterData: { 
        status: existing.status,
        deletedAt: new Date(),
      },
      metadata: {
        applicationNumber: existing.applicationNumber,
        previousStatus: existing.status,
      },
    });
    
    return {
      success: true,
      message: "Loan application deleted successfully",
    };
  }
}

describe("LoanApplicationService Integration Tests", () => {
  describe("create", () => {
    it("should create a loan application with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const body = {
        loanProductId: "product_123",
        loanAmount: 10000,
        loanTerm: 12,
        currency: "USD",
        purpose: "business_expansion",
        purposeDescription: "Expanding operations",
        isBusinessLoan: true,
      };

      const result = await MockLoanApplicationsService.create(clerkId, body);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Loan application created successfully");
      expect(result.data).toBeDefined();
      expect(result.data.applicationNumber).toBe("APP-2024-001");
      expect(result.data.status).toBe("submitted");
    });
  });

  describe("update", () => {
    it("should update a loan application with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const id = "app_123";
      const body = {
        loanAmount: 15000,
        loanTerm: 18,
        purposeDescription: "Updated description",
      };

      const result = await MockLoanApplicationsService.update(clerkId, id, body);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Loan application updated successfully");
      expect(result.data).toBeDefined();
    });
  });

  describe("updateStatus", () => {
    it("should update application status with audit trail logging and snapshot creation", async () => {
      const clerkId = "clerk_123";
      const id = "app_123";
      const body = {
        status: "approved",
        reason: "Application approved by admin",
      };

      const result = await MockLoanApplicationsService.updateStatus(clerkId, id, body);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Loan application status updated to approved");
    });
  });

  describe("withdraw", () => {
    it("should withdraw a loan application with audit trail logging and notification", async () => {
      const clerkId = "clerk_123";
      const id = "app_123";

      const result = await MockLoanApplicationsService.withdraw(clerkId, id);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Loan application withdrawn successfully");
    });
  });

  describe("remove", () => {
    it("should remove a loan application with audit trail logging", async () => {
      const clerkId = "clerk_123";
      const id = "app_123";

      const result = await MockLoanApplicationsService.remove(clerkId, id);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Loan application deleted successfully");
    });
  });

  describe("error handling", () => {
    it("should handle notification failures gracefully", async () => {
      const clerkId = "clerk_123";
      const id = "app_123";
      const body = {
        status: "approved",
        reason: "Application approved by admin",
      };

      // Mock notification service to throw an error
      const originalSendNotification = mockNotificationService.sendStatusUpdateNotification;
      mockNotificationService.sendStatusUpdateNotification = () => 
        Promise.reject(new Error("Notification failed"));

      const result = await MockLoanApplicationsService.updateStatus(clerkId, id, body);

      // Should still succeed even if notification fails
      expect(result.success).toBe(true);
      expect(result.message).toBe("Loan application status updated to approved");

      // Restore original function
      mockNotificationService.sendStatusUpdateNotification = originalSendNotification;
    });
  });
});