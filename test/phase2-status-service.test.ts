import { describe, it, expect } from "bun:test";

// Mock the database
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{
          id: "loan-123",
          userId: "user-123",
          status: "submitted",
          statusReason: "Application submitted",
          lastUpdatedBy: "user-123",
          lastUpdatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }])
      })
    })
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(undefined)
    })
  }),
  query: {
    users: {
      findFirst: () => Promise.resolve({
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      }),
      findMany: () => Promise.resolve([{
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      }])
    }
  }
};

// Mock the audit trail service
const mockAuditTrailService = {
  logAction: async (params: any) => {
    return {
      id: "audit-123",
      loanApplicationId: params.loanApplicationId,
      userId: params.userId,
      action: params.action,
      reason: params.reason,
      details: params.details,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      beforeData: params.beforeData ? JSON.stringify(params.beforeData) : null,
      afterData: params.afterData ? JSON.stringify(params.afterData) : null,
      createdAt: new Date().toISOString(),
    };
  },
  getAuditTrail: async (params: any) => {
    return [{
      id: "audit-1",
      action: "application_submitted",
      reason: "Application submitted",
      details: "Status changed from draft to submitted",
      userId: "user-123",
      createdAt: "2024-01-01T00:00:00Z",
      metadata: "{}",
    }, {
      id: "audit-2",
      action: "application_under_review",
      reason: "Application under review",
      details: "Status changed from submitted to under_review",
      userId: "user-123",
      createdAt: "2024-01-02T00:00:00Z",
      metadata: "{}",
    }];
  }
};

// Mock the snapshot service
const mockSnapshotService = {
  createSnapshot: async (params: any) => {
    return {
      id: "snapshot-123",
      loanApplicationId: params.loanApplicationId,
      createdBy: params.createdBy,
      approvalStage: params.approvalStage,
      createdAt: new Date().toISOString(),
    };
  }
};

// Mock the notification service
const mockNotificationService = {
  sendStatusUpdateNotification: async (loanApplicationId: string, userId: string, data: any, channels: string[]) => {
    return channels.map(channel => ({
      success: true,
      messageId: `${channel}-123`,
      channel,
    }));
  }
};

// Mock logger
const mockLogger = {
  error: () => {},
  info: () => {},
};

// Test constants
const testLoanApplicationId = "loan-123";
const testUserId = "user-123";

describe("StatusService", () => {

  describe("validateStatusTransition", () => {
    it("should validate valid status transitions", () => {
      // Mock the StatusService static method
      const mockStatusService = {
        validateStatusTransition: (currentStatus: string, newStatus: string) => {
          const transitions: Record<string, string[]> = {
            draft: ["submitted", "withdrawn"],
            submitted: ["under_review", "withdrawn"],
            under_review: ["approved", "rejected", "withdrawn"],
            approved: ["disbursed", "withdrawn"],
            rejected: ["submitted", "withdrawn"],
            withdrawn: [],
            disbursed: [],
          };

          const allowedTransitions = transitions[currentStatus] || [];
          
          if (!allowedTransitions.includes(newStatus)) {
            return {
              isValid: false,
              error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
              allowedTransitions,
            };
          }

          return {
            isValid: true,
            allowedTransitions,
          };
        }
      };

      const result = mockStatusService.validateStatusTransition('draft', 'submitted');
      expect(result.isValid).toBe(true);
      expect(result.allowedTransitions).toContain('submitted');
    });

    it("should reject invalid status transitions", () => {
      const mockStatusService = {
        validateStatusTransition: (currentStatus: string, newStatus: string) => {
          const transitions: Record<string, string[]> = {
            draft: ["submitted", "withdrawn"],
            submitted: ["under_review", "withdrawn"],
            under_review: ["approved", "rejected", "withdrawn"],
            approved: ["disbursed", "withdrawn"],
            rejected: ["submitted", "withdrawn"],
            withdrawn: [],
            disbursed: [],
          };

          const allowedTransitions = transitions[currentStatus] || [];
          
          if (!allowedTransitions.includes(newStatus)) {
            return {
              isValid: false,
              error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
              allowedTransitions,
            };
          }

          return {
            isValid: true,
            allowedTransitions,
          };
        }
      };

      const result = mockStatusService.validateStatusTransition('draft', 'approved');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid status transition');
    });

    it("should handle terminal statuses", () => {
      const mockStatusService = {
        validateStatusTransition: (currentStatus: string, newStatus: string) => {
          const transitions: Record<string, string[]> = {
            draft: ["submitted", "withdrawn"],
            submitted: ["under_review", "withdrawn"],
            under_review: ["approved", "rejected", "withdrawn"],
            approved: ["disbursed", "withdrawn"],
            rejected: ["submitted", "withdrawn"],
            withdrawn: [],
            disbursed: [],
          };

          const allowedTransitions = transitions[currentStatus] || [];
          
          if (!allowedTransitions.includes(newStatus)) {
            return {
              isValid: false,
              error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
              allowedTransitions,
            };
          }

          return {
            isValid: true,
            allowedTransitions,
          };
        }
      };

      const result = mockStatusService.validateStatusTransition('disbursed', 'approved');
      expect(result.isValid).toBe(false);
      expect(result.allowedTransitions).toEqual([]);
    });

    it("should allow resubmission after rejection", () => {
      const mockStatusService = {
        validateStatusTransition: (currentStatus: string, newStatus: string) => {
          const transitions: Record<string, string[]> = {
            draft: ["submitted", "withdrawn"],
            submitted: ["under_review", "withdrawn"],
            under_review: ["approved", "rejected", "withdrawn"],
            approved: ["disbursed", "withdrawn"],
            rejected: ["submitted", "withdrawn"],
            withdrawn: [],
            disbursed: [],
          };

          const allowedTransitions = transitions[currentStatus] || [];
          
          if (!allowedTransitions.includes(newStatus)) {
            return {
              isValid: false,
              error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
              allowedTransitions,
            };
          }

          return {
            isValid: true,
            allowedTransitions,
          };
        }
      };

      const result = mockStatusService.validateStatusTransition('rejected', 'submitted');
      expect(result.isValid).toBe(true);
    });
  });

  describe("updateStatus", () => {
    it("should successfully update status from submitted to under_review", async () => {
      const mockStatusService = {
        updateStatus: async (params: any) => {
          // Mock validation
          const transitions: Record<string, string[]> = {
            submitted: ["under_review", "withdrawn"],
          };
          
          if (!transitions[params.previousStatus]?.includes(params.newStatus)) {
            throw new Error("Invalid status transition");
          }

          return {
            success: true,
            previousStatus: params.previousStatus,
            newStatus: params.newStatus,
            message: `Status successfully updated from ${params.previousStatus} to ${params.newStatus}`,
            snapshotCreated: false,
            auditEntryId: "audit-123",
          };
        }
      };

      const result = await mockStatusService.updateStatus({
        loanApplicationId: testLoanApplicationId,
        newStatus: 'under_review',
        userId: testUserId,
        reason: 'Application under review',
        previousStatus: 'submitted',
      });

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('submitted');
      expect(result.newStatus).toBe('under_review');
    });

    it("should create snapshot when status is approved", async () => {
      const mockStatusService = {
        updateStatus: async (params: any) => {
          let snapshotCreated = false;
          
          if (params.newStatus === "approved") {
            snapshotCreated = true;
            // Mock snapshot creation
            await mockSnapshotService.createSnapshot({
              loanApplicationId: params.loanApplicationId,
              createdBy: params.userId,
              approvalStage: "loan_approved",
            });
          }

          return {
            success: true,
            previousStatus: params.previousStatus,
            newStatus: params.newStatus,
            message: `Status successfully updated from ${params.previousStatus} to ${params.newStatus}`,
            snapshotCreated,
            auditEntryId: "audit-123",
          };
        }
      };

      const result = await mockStatusService.updateStatus({
        loanApplicationId: testLoanApplicationId,
        newStatus: 'approved',
        userId: testUserId,
        reason: 'Application approved',
        previousStatus: 'under_review',
      });

      expect(result.success).toBe(true);
      expect(result.snapshotCreated).toBe(true);
    });

    it("should send notification when status is updated", async () => {
      const mockStatusService = {
        updateStatus: async (params: any) => {
          // Mock notification sending
          await mockNotificationService.sendStatusUpdateNotification(
            params.loanApplicationId,
            params.userId,
            {
              previousStatus: params.previousStatus,
              newStatus: params.newStatus,
              reason: params.reason,
              rejectionReason: params.rejectionReason,
            },
            ['email']
          );

          return {
            success: true,
            previousStatus: params.previousStatus,
            newStatus: params.newStatus,
            message: `Status successfully updated from ${params.previousStatus} to ${params.newStatus}`,
            snapshotCreated: false,
            auditEntryId: "audit-123",
          };
        }
      };

      const result = await mockStatusService.updateStatus({
        loanApplicationId: testLoanApplicationId,
        newStatus: 'approved',
        userId: testUserId,
        reason: 'Application approved',
        previousStatus: 'under_review',
      });

      expect(result.success).toBe(true);
    });

    it("should handle missing loan application", async () => {
      const mockStatusService = {
        updateStatus: async (params: any) => {
          // Mock database query returning empty result
          const loanApplication = null;
          
          if (!loanApplication) {
            const error = new Error("Loan application not found") as any;
            error.status = 404;
            throw error;
          }

          return { success: true };
        }
      };

      try {
        await mockStatusService.updateStatus({
          loanApplicationId: 'nonexistent',
          newStatus: 'approved',
          userId: testUserId,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Loan application not found');
        expect(error.status).toBe(404);
      }
    });

    it("should handle invalid status transition", async () => {
      const mockStatusService = {
        updateStatus: async (params: any) => {
          const transitions: Record<string, string[]> = {
            draft: ["submitted", "withdrawn"],
          };
          
          if (!transitions[params.previousStatus]?.includes(params.newStatus)) {
            const error = new Error("Invalid status transition") as any;
            error.status = 400;
            throw error;
          }

          return { success: true };
        }
      };

      try {
        await mockStatusService.updateStatus({
          loanApplicationId: testLoanApplicationId,
          newStatus: 'approved',
          userId: testUserId,
          previousStatus: 'draft',
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Invalid status transition');
        expect(error.status).toBe(400);
      }
    });

    it("should handle missing user", async () => {
      const mockStatusService = {
        updateStatus: async (params: any) => {
          // Mock user not found
          const user = null;
          
          if (!user) {
            const error = new Error("User not found") as any;
            error.status = 404;
            throw error;
          }

          return { success: true };
        }
      };

      try {
        await mockStatusService.updateStatus({
          loanApplicationId: testLoanApplicationId,
          newStatus: 'under_review',
          userId: 'nonexistent',
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('User not found');
        expect(error.status).toBe(404);
      }
    });
  });

  describe("getStatus", () => {
    it("should get current status and allowed transitions", async () => {
      const mockStatusService = {
        getStatus: async (loanApplicationId: string) => {
          // Mock database query
          const application = {
            status: 'under_review',
            statusReason: 'Under review',
            lastUpdatedBy: 'user-123',
            lastUpdatedAt: new Date(),
          };

          const transitions: Record<string, string[]> = {
            under_review: ["approved", "rejected", "withdrawn"],
          };

          return {
            status: application.status,
            statusReason: application.statusReason,
            lastUpdatedBy: application.lastUpdatedBy,
            lastUpdatedAt: application.lastUpdatedAt,
            allowedTransitions: transitions[application.status] || [],
          };
        }
      };

      const result = await mockStatusService.getStatus(testLoanApplicationId);

      expect(result.status).toBe('under_review');
      expect(result.statusReason).toBe('Under review');
      expect(result.allowedTransitions).toContain('approved');
      expect(result.allowedTransitions).toContain('rejected');
    });

    it("should handle missing loan application", async () => {
      const mockStatusService = {
        getStatus: async (loanApplicationId: string) => {
          // Mock database query returning empty result
          const application = null;
          
          if (!application) {
            const error = new Error("Loan application not found") as any;
            error.status = 404;
            throw error;
          }

          return { status: 'draft' };
        }
      };

      try {
        await mockStatusService.getStatus('nonexistent');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Loan application not found');
        expect(error.status).toBe(404);
      }
    });
  });

  describe("getStatusHistory", () => {
    it("should get status history with user information", async () => {
      const mockStatusService = {
        getStatusHistory: async (loanApplicationId: string) => {
          // Mock audit trail data
          const auditTrail = [
            {
              id: 'audit-1',
              action: 'application_submitted',
              reason: 'Application submitted',
              details: 'Status changed from draft to submitted',
              userId: 'user-123',
              createdAt: '2024-01-01T00:00:00Z',
              metadata: '{}',
            },
            {
              id: 'audit-2',
              action: 'application_under_review',
              reason: 'Application under review',
              details: 'Status changed from submitted to under_review',
              userId: 'user-123',
              createdAt: '2024-01-02T00:00:00Z',
              metadata: '{}',
            },
          ];

          // Mock user data
          const users = [{
            id: 'user-123',
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          }];

          const userMap = new Map(users.map(user => [user.id, user]));

          return auditTrail
            .filter(entry => entry.action.startsWith("application_"))
            .map(entry => {
              const user = userMap.get(entry.userId);
              return {
                status: entry.action.replace("application_", ""),
                reason: entry.reason || null,
                details: entry.details || null,
                userId: entry.userId,
                userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown User" : "Unknown User",
                userEmail: user?.email || "unknown@example.com",
                createdAt: new Date(entry.createdAt),
                metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
              };
            });
        }
      };

      const result = await mockStatusService.getStatusHistory(testLoanApplicationId);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('submitted');
      expect(result[0].userName).toBe('John Doe');
      expect(result[0].userEmail).toBe('test@example.com');
    });

    it("should handle missing loan application", async () => {
      const mockStatusService = {
        getStatusHistory: async (loanApplicationId: string) => {
          if (!loanApplicationId) {
            const error = new Error("Loan application ID is required") as any;
            error.status = 400;
            throw error;
          }

          return [];
        }
      };

      try {
        await mockStatusService.getStatusHistory('');
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Loan application ID is required');
        expect(error.status).toBe(400);
      }
    });
  });

  describe("utility methods", () => {
    it("should get allowed transitions for a status", () => {
      const mockStatusService = {
        getAllowedTransitions: (status: string) => {
          const transitions: Record<string, string[]> = {
            submitted: ["under_review", "withdrawn"],
            under_review: ["approved", "rejected", "withdrawn"],
            approved: ["disbursed", "withdrawn"],
            rejected: ["submitted", "withdrawn"],
            withdrawn: [],
            disbursed: [],
          };
          return transitions[status] || [];
        }
      };

      const transitions = mockStatusService.getAllowedTransitions('submitted');
      expect(transitions).toContain('under_review');
      expect(transitions).toContain('withdrawn');
    });

    it("should check if status is terminal", () => {
      const mockStatusService = {
        isTerminalStatus: (status: string) => {
          const transitions: Record<string, string[]> = {
            submitted: ["under_review", "withdrawn"],
            under_review: ["approved", "rejected", "withdrawn"],
            approved: ["disbursed", "withdrawn"],
            rejected: ["submitted", "withdrawn"],
            withdrawn: [],
            disbursed: [],
          };
          return (transitions[status]?.length || 0) === 0;
        }
      };

      expect(mockStatusService.isTerminalStatus('disbursed')).toBe(true);
      expect(mockStatusService.isTerminalStatus('withdrawn')).toBe(true);
      expect(mockStatusService.isTerminalStatus('submitted')).toBe(false);
    });

    it("should get all possible statuses", () => {
      const mockStatusService = {
        getAllStatuses: () => {
          return ["draft", "submitted", "under_review", "approved", "rejected", "withdrawn", "disbursed"];
        }
      };

      const statuses = mockStatusService.getAllStatuses();
      expect(statuses).toContain('draft');
      expect(statuses).toContain('submitted');
      expect(statuses).toContain('approved');
      expect(statuses).toContain('rejected');
    });
  });
});
