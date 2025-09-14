import { Elysia } from "elysia";
import { logger } from "./utils/logger";
import { config } from "dotenv";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import { clerkPlugin } from "elysia-clerk";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { userController } from "./modules/user/user.controller";

config();

const PORT = process.env.PORT || 8081;
const APP_URL = process.env.APP_URL;

const app = new Elysia()
  .use(
    cors({
      origin: APP_URL,
      credentials: true,
    }),
  )
  .use(openapi())
  .get("/", () => "Hello Elysia")
  .get("/health", async () => {
    try {
      const result = await db.execute(sql`select 1 as ok`);
      return { ok: true, result };
    } catch (err: any) {
      logger.error(err, "DB health check failed");
      return new Response("DB Error", { status: 500 });
    }
  })
  .use(clerkPlugin())
  .post("/test", ({body}) => {
    return body
  })
  .use(userController)
  .listen(PORT);

logger.info(`🦊 Elysia is running at ${app.server?.url}`);
