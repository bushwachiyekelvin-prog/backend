import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { LoanApplicationsService } from "../modules/loan-applications/loan-applications.service";
import { LoanApplicationsModel } from "../modules/loan-applications/loan-applications.model";
import { LoanApplicationsSchemas } from "../modules/loan-applications/loan-applications.schemas";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";
import { AuditTrailService } from "../modules/audit-trail/audit-trail.service";
import { SnapshotService } from "../modules/snapshots/snapshot.service";
import { DocumentRequestService } from "../modules/document-requests/document-request.service";
import { StatusService } from "../modules/status/status.service";
// import { StatusModel } from "../modules/status/status.model";
import { AuditTrailResponseSchema, AuditTrailSummaryResponseSchema, AuditTrailQuerySchema, AuditTrailErrorResponses } from "./schemas/audit-trail.schemas";
import { SnapshotResponseSchema, SnapshotsListResponseSchema, SnapshotErrorResponses } from "./schemas/snapshots.schemas";
import { DocumentRequestsListResponseSchema, DocumentRequestStatisticsResponseSchema, DocumentRequestQuerySchema, DocumentRequestErrorResponses } from "./schemas/document-requests.schemas";
import { handleRoute, extractParams, extractQuery } from "./utils/route-handlers";
import { ResponseCachingService } from "../modules/response-caching/response-caching.service";

export async function loanApplicationsRoutes(fastify: FastifyInstance) {
  // CREATE loan application
  fastify.post(
    "/",
    {
      schema: {
        body: LoanApplicationsSchemas.CreateLoanApplicationBodySchema,
        response: {
          200: LoanApplicationsSchemas.CreateLoanApplicationResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await LoanApplicationsService.create(
          userId,
          request.body as LoanApplicationsModel.CreateLoanApplicationBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error creating loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create loan application", code: "CREATE_LOAN_APPLICATION_FAILED" });
      }
    },
  );

  // LIST loan applications with optional query parameters
  fastify.get(
    "/",
    {
      schema: {
        querystring: LoanApplicationsSchemas.ListLoanApplicationsQuerySchema,
        response: {
          200: LoanApplicationsSchemas.ListLoanApplicationsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        // Set cache options for this route
        (request as any).cacheOptions = {
          ...ResponseCachingService.cacheOptions.userSpecific,
          ttl: 2 * 60, // 2 minutes for list endpoints
          tags: ['loan_applications'],
        };
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const query = (request.query as any) || {};
        const result = await LoanApplicationsService.list(userId, query);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing loan applications:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list loan applications", code: "LIST_LOAN_APPLICATIONS_FAILED" });
      }
    },
  );

  // GET loan application by ID
  fastify.get(
    "/:id",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: LoanApplicationsSchemas.GetLoanApplicationResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        // Set cache options for this route
        (request as any).cacheOptions = {
          ...ResponseCachingService.cacheOptions.loanApplication,
          ttl: 5 * 60, // 5 minutes for individual loan applications
        };
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanApplicationsService.getById(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get loan application", code: "GET_LOAN_APPLICATION_FAILED" });
      }
    },
  );

  // UPDATE loan application
  fastify.patch(
    "/:id",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        body: LoanApplicationsSchemas.UpdateLoanApplicationBodySchema,
        response: {
          200: LoanApplicationsSchemas.UpdateLoanApplicationResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanApplicationsService.update(
          userId,
          id,
          request.body as LoanApplicationsModel.UpdateLoanApplicationBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update loan application", code: "UPDATE_LOAN_APPLICATION_FAILED" });
      }
    },
  );

  // WITHDRAW loan application
  fastify.patch(
    "/:id/withdraw",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: LoanApplicationsSchemas.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanApplicationsService.withdraw(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error withdrawing loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to withdraw loan application", code: "WITHDRAW_LOAN_APPLICATION_FAILED" });
      }
    },
  );

  // DELETE loan application (soft delete)
  fastify.delete(
    "/:id",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: LoanApplicationsSchemas.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanApplicationsService.remove(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting loan application:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete loan application", code: "DELETE_LOAN_APPLICATION_FAILED" });
      }
    },
  );

  // ADMIN: UPDATE application status (for loan officers/admins)
  fastify.patch(
    "/:id/status",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        body: LoanApplicationsSchemas.UpdateApplicationStatusBodySchema,
        response: {
          200: LoanApplicationsSchemas.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "admin"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        console.error(`User not found ${userId}`);
        const result = await LoanApplicationsService.updateStatus(
          userId,
          id,
          request.body as LoanApplicationsModel.UpdateApplicationStatusBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating loan application status:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update loan application status", code: "UPDATE_LOAN_APPLICATION_STATUS_FAILED" });
      }
    },
  );

  // ===== AUDIT TRAIL ENDPOINTS =====

  // GET audit trail for a loan application
  fastify.get(
    "/:id/audit-trail",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        querystring: AuditTrailQuerySchema,
        response: {
          200: AuditTrailResponseSchema,
          ...AuditTrailErrorResponses,
        },
        tags: ["loan-applications", "audit-trail"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);
      const { limit, offset, action } = extractQuery(request);

      return handleRoute(request, reply, {
        serviceMethod: () => AuditTrailService.getAuditTrail({
          loanApplicationId: id,
          limit,
          offset,
          action: action as any,
        }),
        successMessage: "Audit trail retrieved successfully",
        errorCode: "GET_AUDIT_TRAIL_FAILED",
      });
    },
  );

  // GET audit trail summary for a loan application
  fastify.get(
    "/:id/audit-trail/summary",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: AuditTrailSummaryResponseSchema,
          ...AuditTrailErrorResponses,
        },
        tags: ["loan-applications", "audit-trail"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);

      return handleRoute(request, reply, {
        serviceMethod: () => AuditTrailService.getAuditTrailSummary(id),
        successMessage: "Audit trail summary retrieved successfully",
        errorCode: "GET_AUDIT_TRAIL_SUMMARY_FAILED",
      });
    },
  );

  // ===== SNAPSHOT ENDPOINTS =====
  // Note: Snapshot creation is handled internally by the loan application service
  // when status is updated to "approved" - no manual creation endpoint needed

  // GET all snapshots for a loan application
  fastify.get(
    "/:id/snapshots",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: SnapshotsListResponseSchema,
          ...SnapshotErrorResponses,
        },
        tags: ["loan-applications", "snapshots"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);

      return handleRoute(request, reply, {
        serviceMethod: () => SnapshotService.getSnapshots(id),
        successMessage: "Snapshots retrieved successfully",
        errorCode: "GET_SNAPSHOTS_FAILED",
      });
    },
  );

  // GET latest snapshot for a loan application
  fastify.get(
    "/:id/snapshots/latest",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: {
            ...SnapshotResponseSchema,
            properties: {
              ...SnapshotResponseSchema.properties,
              data: {
                ...SnapshotResponseSchema.properties.data,
                nullable: true,
              },
            },
          },
          ...SnapshotErrorResponses,
        },
        tags: ["loan-applications", "snapshots"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);

      return handleRoute(request, reply, {
        serviceMethod: async () => {
          const snapshot = await SnapshotService.getLatestSnapshot(id);
          return snapshot;
        },
        successMessage: "Latest snapshot retrieved successfully",
        errorCode: "GET_LATEST_SNAPSHOT_FAILED",
      });
    },
  );

  // ===== DOCUMENT REQUEST ENDPOINTS =====
  // Note: Document request creation should be handled by admin/loan officer workflows
  // through the admin interface, not directly via API

  // GET document requests for a loan application
  fastify.get(
    "/:id/document-requests",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        querystring: DocumentRequestQuerySchema,
        response: {
          200: DocumentRequestsListResponseSchema,
          ...DocumentRequestErrorResponses,
        },
        tags: ["loan-applications", "document-requests"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);
      const { status } = extractQuery(request);

      return handleRoute(request, reply, {
        serviceMethod: () => DocumentRequestService.getRequests(id, status as any),
        successMessage: "Document requests retrieved successfully",
        errorCode: "GET_DOCUMENT_REQUESTS_FAILED",
      });
    },
  );

  // GET document request statistics for a loan application
  fastify.get(
    "/:id/document-requests/statistics",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: DocumentRequestStatisticsResponseSchema,
          ...DocumentRequestErrorResponses,
        },
        tags: ["loan-applications", "document-requests"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);

      return handleRoute(request, reply, {
        serviceMethod: () => DocumentRequestService.getRequestStatistics(id),
        successMessage: "Document request statistics retrieved successfully",
        errorCode: "GET_DOCUMENT_REQUEST_STATISTICS_FAILED",
      });
    },
  );

  // ===== STATUS MANAGEMENT ENDPOINTS =====

  // GET current status and allowed transitions
  fastify.get(
    "/:id/status",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string" },
                  statusReason: { type: "string", nullable: true },
                  lastUpdatedBy: { type: "string", nullable: true },
                  lastUpdatedAt: { type: "string", nullable: true },
                  allowedTransitions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "status"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);

      return handleRoute(request, reply, {
        serviceMethod: () => StatusService.getStatus(id),
        successMessage: "Status retrieved successfully",
        errorCode: "GET_STATUS_FAILED",
      });
    },
  );

  // PUT update status
  fastify.put(
    "/:id/status",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        body: {
          type: "object",
          properties: {
            status: { 
              type: "string",
              enum: ["draft", "submitted", "under_review", "approved", "rejected", "withdrawn", "disbursed"]
            },
            reason: { type: "string" },
            rejectionReason: { type: "string" },
            metadata: { type: "object" },
          },
          required: ["status"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  previousStatus: { type: "string" },
                  newStatus: { type: "string" },
                  message: { type: "string" },
                  snapshotCreated: { type: "boolean" },
                  auditEntryId: { type: "string" },
                },
              },
            },
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "status"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);
      const { status, reason, rejectionReason, metadata } = (request.body as any) || {};

      return handleRoute(request, reply, {
        serviceMethod: async () => {
          const { userId } = getAuth(request);
          if (!userId) {
            throw { status: 401, message: "Unauthorized" };
          }

          logger.info(`Updating status for loan application ${id} to ${status} for user ${userId}`);

          return StatusService.updateStatus({
            loanApplicationId: id,
            newStatus: status,
            userId,
            reason,
            rejectionReason,
            metadata,
          });
        },
        successMessage: "Status updated successfully",
        errorCode: "UPDATE_STATUS_FAILED",
      });
    },
  );

  // GET status history
  fastify.get(
    "/:id/status/history",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    reason: { type: "string", nullable: true },
                    details: { type: "string", nullable: true },
                    userId: { type: "string" },
                    userName: { type: "string" },
                    userEmail: { type: "string" },
                    createdAt: { type: "string" },
                    metadata: { type: "object", nullable: true },
                  },
                },
              },
            },
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "status"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);

      return handleRoute(request, reply, {
        serviceMethod: () => StatusService.getStatusHistory(id),
        successMessage: "Status history retrieved successfully",
        errorCode: "GET_STATUS_HISTORY_FAILED",
      });
    },
  );

  // POST approve loan application
  fastify.post(
    "/:id/approve",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        body: {
          type: "object",
          properties: {
            reason: { type: "string" },
            metadata: { type: "object" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  previousStatus: { type: "string" },
                  newStatus: { type: "string" },
                  message: { type: "string" },
                  snapshotCreated: { type: "boolean" },
                  auditEntryId: { type: "string" },
                },
              },
            },
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "status", "admin"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);
      const { reason, metadata } = (request.body as any) || {};

      return handleRoute(request, reply, {
        serviceMethod: async () => {
          const { userId } = getAuth(request);
          if (!userId) {
            throw { status: 401, message: "Unauthorized" };
          }

          return StatusService.updateStatus({
            loanApplicationId: id,
            newStatus: "approved",
            userId,
            reason: reason || "Loan application approved",
            metadata,
          });
        },
        successMessage: "Loan application approved successfully",
        errorCode: "APPROVE_LOAN_APPLICATION_FAILED",
      });
    },
  );

  // POST reject loan application
  fastify.post(
    "/:id/reject",
    {
      schema: {
        params: LoanApplicationsSchemas.LoanApplicationIdParamsSchema,
        body: {
          type: "object",
          properties: {
            rejectionReason: { type: "string" },
            reason: { type: "string" },
            metadata: { type: "object" },
          },
          required: ["rejectionReason"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                  previousStatus: { type: "string" },
                  newStatus: { type: "string" },
                  message: { type: "string" },
                  snapshotCreated: { type: "boolean" },
                  auditEntryId: { type: "string" },
                },
              },
            },
          },
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-applications", "status", "admin"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = extractParams(request);
      const { rejectionReason, reason, metadata } = (request.body as any) || {};

      return handleRoute(request, reply, {
        serviceMethod: async () => {
          const { userId } = getAuth(request);
          if (!userId) {
            throw { status: 401, message: "Unauthorized" };
          }

          // First check current status
          const currentStatus = await StatusService.getStatus(id);
          
          // If already rejected, return success with appropriate message
          if (currentStatus.status === "rejected") {
            return {
              success: true,
              previousStatus: "rejected",
              newStatus: "rejected",
              message: "Loan application is already rejected",
              snapshotCreated: false,
            };
          }

          // If not rejected, proceed with status update
          return StatusService.updateStatus({
            loanApplicationId: id,
            newStatus: "rejected",
            userId,
            reason: reason || "Loan application rejected",
            rejectionReason,
            metadata,
          });
        },
        successMessage: "Loan application rejected successfully",
        errorCode: "REJECT_LOAN_APPLICATION_FAILED",
      });
    },
  );
}


