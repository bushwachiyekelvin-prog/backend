export namespace UserGroupsModel {
  export interface CreateGroupBody {
    name: string;
    slug?: string; // optional, auto-generated if missing
    description?: string;
    userIds?: string[]; // optional list of existing users to add as members
  }

  export interface EditGroupBody {
    name?: string;
    slug?: string;
    description?: string;
    userIds?: string[]; // replace membership set when provided
    addUserIds?: string[]; // optionally add specific users
    removeUserIds?: string[]; // optionally remove specific users
  }

  export interface GroupItem {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }

  export type GroupIdParams = { id: string };

  export const GroupItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      slug: { type: "string" },
      description: { type: "string" },
      createdAt: { type: "string" },
      updatedAt: { type: "string" },
    },
    required: ["id", "name", "slug"],
    additionalProperties: true,
  } as const;

  export const CreateGroupBodySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 150 },
      slug: { type: "string", minLength: 1, maxLength: 150 },
      description: { type: "string" },
      userIds: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    },
    required: ["name"],
  } as const;

  export const EditGroupBodySchema = {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 150 },
      slug: { type: "string", minLength: 1, maxLength: 150 },
      description: { type: "string" },
      userIds: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      addUserIds: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
      removeUserIds: { type: "array", items: { type: "string", minLength: 1 }, uniqueItems: true },
    },
  } as const;

  export const ListGroupsResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: GroupItemSchema },
    },
    required: ["success", "message", "data"],
  } as const;

  export const BasicSuccessResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
    },
    required: ["success", "message"],
  } as const;

  // Members listing
  export interface GroupMemberItem {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    imageUrl?: string | null;
  }

  export interface ListGroupMembersQuery {
    page?: string; // number as string
    limit?: string; // number as string
  }

  export const GroupMemberItemSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string" },
      phoneNumber: { type: "string" },
      imageUrl: { type: "string" },
    },
    required: ["id"],
    additionalProperties: true,
  } as const;

  export const ListGroupMembersResponseSchema = {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      data: { type: "array", items: GroupMemberItemSchema },
      pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
        required: ["page", "limit", "total", "totalPages"],
      },
    },
    required: ["success", "message", "data"],
    additionalProperties: true,
  } as const;
}
