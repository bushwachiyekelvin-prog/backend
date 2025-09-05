import { Elysia } from "elysia";
import { logger } from "./utils/logger";
import { config } from "dotenv";
import cors from "@elysiajs/cors";
import openapi from "@elysiajs/openapi";
import { clerkPlugin } from "elysia-clerk";

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
  .use(clerkPlugin())
  .get("/", () => "Hello Elysia")
  .get("/health", () => "OK")
  .listen(PORT);

logger.info(
  `🦊 Elysia is running at ${app.server?.url}`,
);
