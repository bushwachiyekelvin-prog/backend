import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getAuth } from "@clerk/fastify";
import { UserGroupsService } from "../modules/user-groups/user-groups.service";
import { UserGroupsModel } from "../modules/user-groups/user-groups.model";
import { UserModel } from "../modules/user/user.model";
import { logger } from "../utils/logger";

export async function userGroupsRoutes(fastify: FastifyInstance) {
  // CREATE group
  fastify.post(
    "/",
    {
      schema: {
        body: UserGroupsModel.CreateGroupBodySchema,
        response: {
          200: UserGroupsModel.GroupItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user-groups"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const result = await UserGroupsService.create(
          userId,
          request.body as UserGroupsModel.CreateGroupBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error creating user group:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to create user group", code: "CREATE_USER_GROUP_FAILED" });
      }
    },
  );

  // LIST group members
  fastify.get(
    "/:id/members",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", minLength: 1 } }, required: ["id"], additionalProperties: false },
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            page: { type: "string", pattern: "^[0-9]+$" },
            limit: { type: "string", pattern: "^[0-9]+$" },
          },
        },
        response: {
          200: UserGroupsModel.ListGroupMembersResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user-groups"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = (request.params as any) || {};
        // Enable response caching for this request (medium TTL)
        (request as any).cacheOptions = {
          ...((request.server as any).responseCache?.cacheOptions?.medium ?? { ttl: 300 }),
          tags: [
            `user_group:${id}:members`,
          ],
        };
        const result = await UserGroupsService.listMembers(id, request.query as UserGroupsModel.ListGroupMembersQuery);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing group members:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list group members", code: "LIST_GROUP_MEMBERS_FAILED" });
      }
    },
  );

  // LIST groups
  fastify.get(
    "/",
    {
      schema: {
        response: {
          200: UserGroupsModel.ListGroupsResponseSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user-groups"],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const result = await UserGroupsService.list();
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error listing user groups:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to list user groups", code: "LIST_USER_GROUPS_FAILED" });
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
          200: UserGroupsModel.GroupItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user-groups"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = (request.params as any) || {};
        const result = await UserGroupsService.getById(id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error getting user group:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to get user group", code: "GET_USER_GROUP_FAILED" });
      }
    },
  );

  // UPDATE
  fastify.patch(
    "/:id",
    {
      schema: {
        params: { type: "object", properties: { id: { type: "string", minLength: 1 } }, required: ["id"], additionalProperties: false },
        body: UserGroupsModel.EditGroupBodySchema,
        response: {
          200: UserGroupsModel.GroupItemSchema,
          400: UserModel.ErrorResponseSchema,
          401: UserModel.ErrorResponseSchema,
          404: UserModel.ErrorResponseSchema,
          500: UserModel.ErrorResponseSchema,
        },
        tags: ["user-groups"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await UserGroupsService.update(
          userId,
          id,
          request.body as UserGroupsModel.EditGroupBody,
        );
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error updating user group:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to update user group", code: "UPDATE_USER_GROUP_FAILED" });
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
        tags: ["user-groups"],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { userId } = getAuth(request);
        if (!userId) {
          return reply.code(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
        }
        const { id } = (request.params as any) || {};
        const result = await UserGroupsService.remove(userId, id);
        return reply.send(result);
      } catch (error: any) {
        logger.error("Error deleting user group:", error);
        if (error?.status) {
          return reply.code(error.status).send({
            error: error.message,
            code: String(error.message).split("] ")[0].replace("[", ""),
          });
        }
        return reply
          .code(500)
          .send({ error: "Failed to delete user group", code: "DELETE_USER_GROUP_FAILED" });
      }
    },
  );
}
