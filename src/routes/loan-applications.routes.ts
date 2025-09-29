import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { LoanApplicationsService } from "../modules/loan-applications/loan-applications.service";
import { LoanApplicationsModel } from "../modules/loan-applications/loan-applications.model";
import { LoanApplicationsSchemas } from "../modules/loan-applications/loan-applications.schemas";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

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
}


