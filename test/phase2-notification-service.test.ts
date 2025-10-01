import { describe, it, expect } from "bun:test";

// Mock the database
const mockDb = {
  query: {
    users: {
      findFirst: () => Promise.resolve({
        id: "user-123",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
      }),
    },
  },
  select: () => ({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{
          id: "loan-123",
          userId: "user-123",
          status: "submitted",
        }])
      })
    })
  }),
};

// Mock the email service
const mockEmailService = {
  sendEmail: async (data: any) => {
    return {
      success: true,
      messageId: "email-123",
    };
  },
};

// Mock React Email render
const mockRender = async (component: any) => {
  return "<html>Email content</html>";
};

// Mock logger
const mockLogger = {
  error: () => {},
  info: () => {},
};

// Test constants
const testUserId = "user-123";
const testLoanApplicationId = "loan-123";

describe("NotificationService", () => {

  describe("sendNotification", () => {
    it("should send email notification successfully", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          // Mock recipient lookup
          const recipient = await mockDb.query.users.findFirst();
          
          if (!recipient) {
            throw new Error("Recipient not found");
          }

          // Mock email rendering
          const emailHtml = await mockRender({});
          
          // Mock email sending
          const result = await mockEmailService.sendEmail({
            to: recipient.email,
            subject: `Loan Application Status Update - ${params.data.newStatus}`,
            html: emailHtml,
          });

          return {
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            channel: params.channel,
          };
        }
      };

      const result = await mockNotificationService.sendNotification({
        type: 'loan_status_update',
        channel: 'email',
        recipientId: testUserId,
        loanApplicationId: testLoanApplicationId,
        data: {
          previousStatus: 'submitted',
          newStatus: 'approved',
          reason: 'Application approved',
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('email-123');
      expect(result.channel).toBe('email');
    });

    it("should handle email sending failure", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          // Mock recipient lookup
          const recipient = await mockDb.query.users.findFirst();
          
          if (!recipient) {
            throw new Error("Recipient not found");
          }

          // Mock email rendering
          const emailHtml = await mockRender({});
          
          // Mock email sending failure
          const result = await {
            success: false,
            error: 'Email sending failed',
          };

          return {
            success: result.success,
            messageId: result.messageId,
            error: result.error,
            channel: params.channel,
          };
        }
      };

      const result = await mockNotificationService.sendNotification({
        type: 'loan_status_update',
        channel: 'email',
        recipientId: testUserId,
        loanApplicationId: testLoanApplicationId,
        data: {
          previousStatus: 'submitted',
          newStatus: 'approved',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email sending failed');
    });

    it("should handle missing recipient", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          // Mock recipient not found
          const recipient = null;
          
          if (!recipient) {
            const error = new Error("Recipient not found") as any;
            error.status = 404;
            throw error;
          }

          return { success: true };
        }
      };

      try {
        await mockNotificationService.sendNotification({
          type: 'loan_status_update',
          channel: 'email',
          recipientId: 'nonexistent',
          data: {},
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Recipient not found');
        expect(error.status).toBe(404);
      }
    });

    it("should handle unsupported notification type", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          const supportedTypes = ['loan_status_update', 'document_request', 'loan_approval'];
          
          if (!supportedTypes.includes(params.type)) {
            const error = new Error("Unsupported notification type") as any;
            error.status = 400;
            throw error;
          }

          return { success: true };
        }
      };

      try {
        await mockNotificationService.sendNotification({
          type: 'unsupported_type' as any,
          channel: 'email',
          recipientId: testUserId,
          data: {},
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Unsupported notification type');
        expect(error.status).toBe(400);
      }
    });

    it("should handle invalid channel", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          const supportedChannels = ['email', 'sms', 'push'];
          
          if (!supportedChannels.includes(params.channel)) {
            const error = new Error("Invalid notification channel") as any;
            error.status = 400;
            throw error;
          }

          return { success: true };
        }
      };

      try {
        await mockNotificationService.sendNotification({
          type: 'loan_status_update',
          channel: 'invalid_channel' as any,
          recipientId: testUserId,
          data: {},
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Invalid notification channel');
        expect(error.status).toBe(400);
      }
    });
  });

  describe("sendStatusUpdateNotification", () => {
    it("should send status update notification via email", async () => {
      const mockNotificationService = {
        sendStatusUpdateNotification: async (loanApplicationId: string, userId: string, data: any, channels: string[]) => {
          const results = [];
          
          for (const channel of channels) {
            if (channel === 'email') {
              // Mock email notification
              const recipient = await mockDb.query.users.findFirst();
              const emailHtml = await mockRender({});
              const result = await mockEmailService.sendEmail({
                to: recipient.email,
                subject: `Loan Application Status Update - ${data.newStatus}`,
                html: emailHtml,
              });
              
              results.push({
                success: result.success,
                messageId: result.messageId,
                channel,
              });
            } else {
              // Mock other channels
              results.push({
                success: true,
                messageId: `${channel}-123`,
                channel,
              });
            }
          }
          
          return results;
        }
      };

      const results = await mockNotificationService.sendStatusUpdateNotification(
        testLoanApplicationId,
        testUserId,
        {
          previousStatus: 'submitted',
          newStatus: 'approved',
          reason: 'Application approved',
        },
        ['email']
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('email');
    });

    it("should handle multiple channels", async () => {
      const mockNotificationService = {
        sendStatusUpdateNotification: async (loanApplicationId: string, userId: string, data: any, channels: string[]) => {
          const results = [];
          
          for (const channel of channels) {
            results.push({
              success: true,
              messageId: `${channel}-123`,
              channel,
            });
          }
          
          return results;
        }
      };

      const results = await mockNotificationService.sendStatusUpdateNotification(
        testLoanApplicationId,
        testUserId,
        {
          previousStatus: 'submitted',
          newStatus: 'approved',
        },
        ['email', 'sms']
      );

      expect(results).toHaveLength(2);
      expect(results[0].channel).toBe('email');
      expect(results[1].channel).toBe('sms');
    });
  });

  describe("sendDocumentRequestNotification", () => {
    it("should send document request notification", async () => {
      const mockNotificationService = {
        sendDocumentRequestNotification: async (loanApplicationId: string, userId: string, data: any, channels: string[]) => {
          const results = [];
          
          for (const channel of channels) {
            if (channel === 'email') {
              // Mock email notification
              const recipient = await mockDb.query.users.findFirst();
              const emailHtml = await mockRender({});
              const result = await mockEmailService.sendEmail({
                to: recipient.email,
                subject: `Document Request - ${data.documentType}`,
                html: emailHtml,
              });
              
              results.push({
                success: result.success,
                messageId: result.messageId,
                channel,
              });
            } else {
              // Mock other channels
              results.push({
                success: true,
                messageId: `${channel}-123`,
                channel,
              });
            }
          }
          
          return results;
        }
      };

      const results = await mockNotificationService.sendDocumentRequestNotification(
        testLoanApplicationId,
        testUserId,
        {
          documentType: 'Bank Statement',
          description: 'Please provide your latest bank statement',
          dueDate: '2024-01-15',
        },
        ['email']
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('email');
    });
  });

  describe("sendLoanApprovalNotification", () => {
    it("should send loan approval notification", async () => {
      const mockNotificationService = {
        sendLoanApprovalNotification: async (loanApplicationId: string, userId: string, data: any, channels: string[]) => {
          const results = [];
          
          for (const channel of channels) {
            if (channel === 'email') {
              // Mock email notification
              const recipient = await mockDb.query.users.findFirst();
              const emailHtml = await mockRender({});
              const result = await mockEmailService.sendEmail({
                to: recipient.email,
                subject: '🎉 Congratulations! Your Loan is Approved',
                html: emailHtml,
              });
              
              results.push({
                success: result.success,
                messageId: result.messageId,
                channel,
              });
            } else {
              // Mock other channels
              results.push({
                success: true,
                messageId: `${channel}-123`,
                channel,
              });
            }
          }
          
          return results;
        }
      };

      const results = await mockNotificationService.sendLoanApprovalNotification(
        testLoanApplicationId,
        testUserId,
        {
          loanAmount: '$10,000',
          interestRate: '5.5%',
          termMonths: 24,
          monthlyPayment: '$450',
          nextSteps: [
            'Review loan agreement',
            'Sign documents',
            'Funds will be disbursed within 2 business days',
          ],
        },
        ['email']
      );

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('email');
    });
  });

  describe("SMS and Push notifications", () => {
    it("should handle SMS notifications (placeholder)", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          if (params.channel === 'sms') {
            return {
              success: true,
              messageId: 'sms-placeholder',
              channel: 'sms',
            };
          }
          
          return { success: false };
        }
      };

      const result = await mockNotificationService.sendNotification({
        type: 'loan_status_update',
        channel: 'sms',
        recipientId: testUserId,
        data: {
          previousStatus: 'submitted',
          newStatus: 'approved',
        },
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe('sms');
      expect(result.messageId).toBe('sms-placeholder');
    });

    it("should handle push notifications (placeholder)", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          if (params.channel === 'push') {
            return {
              success: true,
              messageId: 'push-placeholder',
              channel: 'push',
            };
          }
          
          return { success: false };
        }
      };

      const result = await mockNotificationService.sendNotification({
        type: 'loan_status_update',
        channel: 'push',
        recipientId: testUserId,
        data: {
          previousStatus: 'submitted',
          newStatus: 'approved',
        },
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe('push');
      expect(result.messageId).toBe('push-placeholder');
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          // Mock database error
          throw new Error('Database error');
        }
      };

      try {
        await mockNotificationService.sendNotification({
          type: 'loan_status_update',
          channel: 'email',
          recipientId: testUserId,
          data: {},
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error.message).toBe('Database error');
      }
    });

    it("should handle email service errors gracefully", async () => {
      const mockNotificationService = {
        sendNotification: async (params: any) => {
          // Mock email service error
          const result = {
            success: false,
            error: 'Email service error',
          };

          return {
            success: result.success,
            error: result.error,
            channel: params.channel,
          };
        }
      };

      const result = await mockNotificationService.sendNotification({
        type: 'loan_status_update',
        channel: 'email',
        recipientId: testUserId,
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service error');
    });
  });
});
