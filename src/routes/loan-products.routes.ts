import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { LoanProductsService } from "../modules/loan-products/loan-products.service";
import { LoanProductsModel } from "../modules/loan-products/loan-products.model";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function loanProductsRoutes(fastify: FastifyInstance) {
  // CREATE loan product
  fastify.post(
    "/",
    {
      schema: {
        body: LoanProductsModel.CreateLoanProductBodySchema,
        response: {
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await LoanProductsService.create(
          userId,
          request.body as LoanProductsModel.CreateLoanProductBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error creating loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create loan product", code: "CREATE_LOAN_PRODUCT_FAILED" });
      }
    },
  );

  // LIST loan products
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: LoanProductsModel.ListLoanProductsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await LoanProductsService.list(userId);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing loan products:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list loan products", code: "LIST_LOAN_PRODUCTS_FAILED" });
      }
    },
  );

  // GET by ID
  fastify.get(
    "/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", minLength: 1 } }, required: ["id"], additionalProperties: false },
        response: {
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanProductsService.getById(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get loan product", code: "GET_LOAN_PRODUCT_FAILED" });
      }
    },
  );

  // UPDATE
  fastify.patch(
    "/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", minLength: 1 } }, required: ["id"], additionalProperties: false },
        body: LoanProductsModel.EditLoanProductBodySchema,
        response: {
          200: LoanProductsModel.LoanProductItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanProductsService.update(
          userId,
          id,
          request.body as LoanProductsModel.EditLoanProductBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update loan product", code: "UPDATE_LOAN_PRODUCT_FAILED" });
      }
    },
  );

  // DELETE (soft)
  fastify.delete(
    "/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", minLength: 1 } }, required: ["id"], additionalProperties: false },
        response: {
          200: UserModel.BasicSuccessResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["loan-products"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await LoanProductsService.remove(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting loan product:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete loan product", code: "DELETE_LOAN_PRODUCT_FAILED" });
      }
    },
  );
}
