import { UserModel } from "./user.model";
import { db } from "../../db";
import { users } from "../../db/schema/users";
import { status } from "elysia";
import { logger } from "../../utils/logger";

export abstract class User {
  static async signUp(
    userPayload: UserModel.signUpBody,
  ): Promise<UserModel.signUpResponse> {
    try {
      const user = await db.insert(users).values(userPayload).returning();
      return {
        email: user[0].email,
      };
    } catch (error: any) {
      logger.error(error);
      throw status(500, "[SIGNUP_ERROR] An error occurred while signing up");
    }
  }
}
