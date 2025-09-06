import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";
import { logger } from "./src/utils/logger";

loadEnv({ path: "./.env.local" });

logger.info(`Drizzle config loaded: ${process.env.DATABASE_URL}`);

export default {
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // You can set casing here if you prefer snake_case
  // schemaFilter: ["public"],
} satisfies Config;
