import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { logger } from "../utils/logger";
import { BusinessDocuments } from "../modules/business-documents/business-documents.service";
import { BusinessDocumentsModel } from "../modules/business-documents/business-documents.model";
import { UserModel } from "../modules/user/user.model";

export async function businessDocumentsRoutes(fastify: FastifyInstance) {
  // POST /business/:id/documents — upsert one or many business documents
  fastify.post(
    "/:id/documents",
    {
      schema: {
        params: BusinessDocumentsModel.BusinessIdParamsSchema,
        body: BusinessDocumentsModel.AddDocumentsBodySchema,
        response: {
          200: BusinessDocumentsModel.AddDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business-documents"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await BusinessDocuments.upsert(
          userId,
          id,
          request.body as BusinessDocumentsModel.AddDocumentsBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error upserting business documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to upsert business documents", code: "UPSERT_BUSINESS_DOCUMENTS_FAILED" });
      }
    },
  );

  // GET /business/:id/documents — list all active business documents
  fastify.get(
    "/:id/documents",
    {
      schema: {
        params: BusinessDocumentsModel.BusinessIdParamsSchema,
        response: {
          200: BusinessDocumentsModel.ListDocumentsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["business-documents"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await BusinessDocuments.list(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing business documents:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list business documents", code: "LIST_BUSINESS_DOCUMENTS_FAILED" });
      }
    },
  );
}
