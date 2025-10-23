import type { Config } from "drizzle-kit";
import { config as loadEnv } from "dotenv";
import { logger } from "./src/utils/logger";

loadEnv({ path: "./.env.local" });

logger.info(`Drizzle config loaded: ${process.env.DATABASE_URL}`);

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not defined");
}

export default {
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url
  },
} satisfies Config;
